import type {
  ChatReply,
  Conversation,
  Lang,
  Message,
  Network,
  Quote,
  SessionUser,
  Ticket,
  ToolTrace,
} from "@/lib/types";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export interface ChatPayload {
  conversation: Conversation;
  userMessage: Message;
  assistantMessage: Message;
  passenger: string;
}

export interface ChatHooks {
  /** A tool finished; render it in the live trace. */
  onStep?: (trace: ToolTrace) => void;
  /** Assistant text arriving token by token. */
  onDelta?: (text: string) => void;
  /** The user's persisted message, once the server has stored it. */
  onUserMessage?: (message: Message) => void;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? "request_failed", response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  me: () => request<{ user: SessionUser }>("/api/auth/me"),


  login: (username: string, password: string) =>
    request<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string) =>
    request<{ user: SessionUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  listConversations: () =>
    request<{ conversations: Conversation[] }>("/api/conversations"),

  createConversation: () =>
    request<{ conversation: Conversation }>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getConversation: (id: string) =>
    request<{ conversation: Conversation; messages: Message[] }>(
      `/api/conversations/${id}`,
    ),

  chat: (
    payload: { conversationId?: string; text: string; lang: Lang },
    hooks?: ChatHooks,
  ): Promise<ChatPayload> =>
    hooks
      ? streamChat(payload, hooks)
      : request<ChatPayload>("/api/chat", {
          method: "POST",
          body: JSON.stringify(payload),
        }),

  consentQuote: (quoteId: string, snapshotHash: string) =>
    request<{ nonce: string; expiresAt: string; snapshotHash: string }>(
      `/api/quotes/${quoteId}/consent`,
      {
        method: "POST",
        body: JSON.stringify({ snapshotHash }),
      },
    ),

  confirmQuote: (quoteId: string, nonce: string) =>
    request<{ quote: Quote; ticket: Ticket }>(`/api/quotes/${quoteId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ nonce }),
    }),

  listTickets: () => request<{ tickets: Ticket[] }>("/api/tickets"),

  getNetwork: () => request<{ network: Network }>("/api/network"),
};

/**
 * Consumes the server's SSE stream. Falls back to the plain JSON endpoint if the
 * stream cannot be opened, so a proxy that buffers events cannot break chat.
 */
async function streamChat(
  payload: { conversationId?: string; text: string; lang: Lang },
  hooks: ChatHooks,
): Promise<ChatPayload> {
  const json = () =>
    request<ChatPayload>("/api/chat", { method: "POST", body: JSON.stringify(payload) });

  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, stream: true }),
      cache: "no-store",
    });
  } catch {
    return json();
  }

  const isStream = (response.headers.get("content-type") ?? "").includes("text/event-stream");
  if (!response.ok || !response.body || !isStream) return json();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: ChatPayload | null = null;

  const handle = (event: string, data: string) => {
    const parsed = JSON.parse(data) as unknown;
    switch (event) {
      case "user":
        hooks.onUserMessage?.(parsed as Message);
        break;
      case "step":
        hooks.onStep?.(parsed as ToolTrace);
        break;
      case "delta":
        hooks.onDelta?.((parsed as { text: string }).text);
        break;
      case "done":
        done = parsed as ChatPayload;
        break;
      case "error":
        throw new ApiError((parsed as { code?: string }).code ?? "chat_failed", 500);
      default:
        break;
    }
  };

  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trim());
      }
      if (data.length > 0) handle(event, data.join("\n"));
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (!done) throw new ApiError("chat_failed", 500);
  return done;
}
