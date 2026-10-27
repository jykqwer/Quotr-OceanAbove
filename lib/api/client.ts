import type {
  ChatReply,
  Conversation,
  Lang,
  Message,
  Network,
  Quote,
  SessionUser,
  Ticket,
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

  chat: (payload: { conversationId?: string; text: string; lang: Lang }) =>
    request<ChatReply & { conversation: Conversation; passenger: string }>("/api/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  confirmQuote: (quoteId: string, conversationId: string) =>
    request<{ quote: Quote; ticket: Ticket }>(`/api/quotes/${quoteId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ conversationId }),
    }),

  listTickets: () => request<{ tickets: Ticket[] }>("/api/tickets"),

  getNetwork: () => request<{ network: Network }>("/api/network"),
};
