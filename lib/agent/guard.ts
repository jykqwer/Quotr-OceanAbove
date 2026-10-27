import { PRICE_PER_KM } from "@/lib/domain/pricing";

/** Matches 1,628.02 and 1628 as whole tokens, not the pieces of a longer word. */
const NUMBER_RE = /(?<![\w.])\d[\d,]*(?:\.\d+)?/g;

export function normalizeNumber(raw: string): string {
  return raw.replace(/[,\s]/g, "").replace(/\.0+$/, "").replace(/^(\d+)\.$/, "$1");
}

/**
 * Every numeric token in a value, however deeply nested. Tool results are the
 * only legitimate source of numbers the assistant may print, so this is what
 * builds the allow-list.
 */
export function collectNumbers(value: unknown, into = new Set<string>()): Set<string> {
  const visit = (node: unknown) => {
    if (typeof node === "number") {
      if (Number.isFinite(node)) into.add(normalizeNumber(String(node)));
      return;
    }
    if (typeof node === "string") {
      for (const match of node.matchAll(NUMBER_RE)) into.add(normalizeNumber(match[0]));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === "object") {
      Object.values(node).forEach(visit);
    }
  };
  visit(value);
  return into;
}

/** The price formula's constant is a published rule, not a computed claim. */
export function baseAllowedNumbers(): Set<string> {
  return new Set([normalizeNumber(String(PRICE_PER_KM))]);
}

export interface NumberCheck {
  ok: boolean;
  offending: string[];
}

/**
 * Rejects any number the domain engine did not produce. The model may phrase
 * things however it likes, but it may not introduce a figure of its own.
 */
export function checkNumbers(text: string, allowed: Set<string>): NumberCheck {
  const offending: string[] = [];
  for (const match of text.matchAll(NUMBER_RE)) {
    const token = normalizeNumber(match[0]);
    if (!allowed.has(token) && !offending.includes(token)) offending.push(token);
  }
  return { ok: offending.length === 0, offending };
}

const CLAIM_RE = /\b(booked|issued|ticketed|purchased|paid|charged)\b|已出票|已预订|已预定|已支付|已确认|出票成功/gi;
const NEGATION_RE =
  /\b(not|no|none|nothing|nobody|never|cannot|can't|can’t|won't|unable|nor)\b|未|没|尚未|不能|无法/i;

/**
 * The assistant can never issue a ticket, so it may never claim one exists.
 * Negative phrasing ("not yet booked") is fine; an affirmative claim is not.
 */
export function checkClaims(text: string): { ok: boolean; offending: string[] } {
  const offending: string[] = [];
  for (const match of text.matchAll(CLAIM_RE)) {
    const start = match.index ?? 0;
    const before = text.slice(Math.max(0, start - 24), start);
    if (NEGATION_RE.test(before)) continue;
    offending.push(match[0]);
  }
  return { ok: offending.length === 0, offending };
}
