export type Lang = "zh" | "en";

export type MessageRole = "user" | "assistant";

export type QuoteStatus = "pending" | "booked" | "expired";

export interface Leg {
  seq: number;
  from: string;
  to: string;
  distanceKm: number;
}

/** One city pair of the trip. A single-trip booking has exactly one journey. */
export interface Journey {
  origin: string;
  destination: string;
  legs: Leg[];
  transfers: string[];
  totalDistanceKm: number;
}

export interface Quote {
  id: string;
  conversationId: string;
  origin: string;
  destination: string;
  journeys: Journey[];
  passengers: string[];
  /** Sum of every journey distance (each journey being the sum of its rounded legs). */
  totalDistanceKm: number;
  /** Fare for one passenger: round(totalDistanceKm × 0.13, 2). */
  priceUsd: number;
  /** priceUsd × passengers.length, rounded to 2 dp. */
  totalPriceUsd: number;
  status: QuoteStatus;
  createdAt: string;
  expiresAt: string;
  /** Hash of the immutable snapshot; the client echoes it back to consent. */
  snapshotHash: string;
}

export interface Ticket {
  id: string;
  quoteId: string;
  origin: string;
  destination: string;
  journeys: Journey[];
  passengers: string[];
  totalDistanceKm: number;
  priceUsd: number;
  totalPriceUsd: number;
  bookedAt: string;
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
