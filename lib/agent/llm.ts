/**
 * Minimal OpenAI-compatible chat client (DeepSeek). Streaming only — the agent
 * forwards text deltas to the UI as they arrive.
 */

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: LlmToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface LlmToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmCompletion {
  content: string;
  toolCalls: LlmToolCall[];
  finishReason: string;
}

export class LlmError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

export function llmConfig() {
  return {
    baseUrl: (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, ""),
    model: process.env.LLM_MODEL || "deepseek-chat",
    apiKey: process.env.LLM_API_KEY || "",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 20_000),
  };
}

export function isLlmConfigured(): boolean {
  const { apiKey, baseUrl } = llmConfig();
  return apiKey.length > 0 && baseUrl.length > 0;
}

export interface StreamChatOptions {
  messages: LlmMessage[];
  tools: LlmToolSchema[];
  signal?: AbortSignal;
  /** Called for every content delta so the UI can render text as it arrives. */
  onDelta?: (text: string) => void;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

interface WireToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Runs one completion and returns the assembled message. Tool-call arguments
 * arrive as fragments across chunks, so they are concatenated per index.
 */
export async function streamChat(options: StreamChatOptions): Promise<LlmCompletion> {
  const { baseUrl, model, apiKey, timeoutMs } = llmConfig();
  if (!apiKey) throw new LlmError("llm_not_configured");

  const doFetch = options.fetchImpl ?? fetch;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  const response = await doFetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages.map(toWireMessage),
      tools: options.tools.map((tool) => ({ type: "function", function: tool })),
      tool_choice: "auto",
      temperature: 0.2,
      stream: true,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new LlmError(`llm_http_${response.status}: ${detail.slice(0, 200)}`, response.status);
  }

  let content = "";
  let finishReason = "";
  const calls: WireToolCall[] = [];

  for await (const event of parseSse(response.body)) {
    if (event === "[DONE]") break;
    const chunk = safeParse(event);
    if (!chunk) continue;

    const choice = chunk.choices?.[0];
    if (!choice) continue;
    if (choice.finish_reason) finishReason = choice.finish_reason;

    const delta = choice.delta;
    if (!delta) continue;

    if (typeof delta.content === "string" && delta.content.length > 0) {
      content += delta.content;
      options.onDelta?.(delta.content);
    }

    for (const call of delta.tool_calls ?? []) {
      const index = typeof call.index === "number" ? call.index : calls.length;
      const slot = (calls[index] ??= { id: "", name: "", arguments: "" });
      if (call.id) slot.id = call.id;
      if (call.function?.name) slot.name = call.function.name;
      if (call.function?.arguments) slot.arguments += call.function.arguments;
    }
  }

  const toolCalls = calls
    .filter((call) => call.name.length > 0)
    .map((call, index) => ({
      id: call.id || `call_${index}`,
      name: call.name,
      arguments: call.arguments || "{}",
    }));

  return { content: content.trim(), toolCalls, finishReason };
}

/** Splits an SSE body into `data:` payloads, tolerating CRLF and split chunks. */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          yield trimmed.slice(5).trim();
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

interface WireChunk {  choices?: {
    finish_reason?: string | null;
    delta?: {
      content?: string;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
  }[];
}

function safeParse(raw: string): WireChunk | null {
  try {
    return JSON.parse(raw) as WireChunk;
  } catch {
    return null;
  }
}

/**
 * The API expects the OpenAI wire shape for tool calls; our internal form is
 * flat so the loop can read it directly.
 */
function toWireMessage(message: LlmMessage): unknown {
  if (message.role === "assistant" && message.tool_calls?.length) {
    return {
      role: "assistant",
      content: message.content,
      tool_calls: message.tool_calls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  }
  return message;
}
