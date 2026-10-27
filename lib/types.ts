export type Lang = "zh" | "en";

export type MessageRole = "user" | "assistant";

export type QuoteStatus = "pending" | "booked" | "expired";

export interface Leg {
  seq: number;
  from: string;
  to: string;
  distanceKm: number;
}

export interface Quote {
  id: string;
  conversationId: string;
  origin: string;
  destination: string;
  legs: Leg[];
  transfers: string[];
  totalDistanceKm: number;
  priceUsd: number;
  status: QuoteStatus;
  createdAt: string;
  expiresAt: string;
}

export interface Ticket {
  id: string;
  quoteId: string;
  origin: string;
  destination: string;
  legs: Leg[];
  totalDistanceKm: number;
  priceUsd: number;
  bookedAt: string;
  passenger: string;
}

export interface ToolTrace {
  name: string;
  ok: boolean;
  ms: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  quote?: Quote;
  tools?: ToolTrace[];
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  updatedAt: string;
}

export interface SessionUser {
  username: string;
  displayName: string;
}

export interface ChatReply {
  userMessage: Message;
  assistantMessage: Message;
}

export interface NetworkCity {
  name: string;
  x: number;
  y: number;
  isHub: boolean;
  hubs: string[];
}

export interface NetworkLink {
  a: string;
  b: string;
}

export interface Network {
  cities: NetworkCity[];
  links: NetworkLink[];
  stats: {
    cities: number;
    hubs: number;
    links: number;
    citiesWithoutService: number;
  };
}
