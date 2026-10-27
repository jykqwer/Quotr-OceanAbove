"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { Conversation } from "@/lib/types";

/**
 * Search + cursor pagination for conversation lists. Typing is debounced so a
 * keystroke storm does not hammer the API, and a stale response can never
 * overwrite a newer term.
 */
export function useConversationSearch(errorMessage: string) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [items, setItems] = useState<Conversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (query: string) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const page = await api.listConversations({ search: query });
        if (id !== requestId.current) return;
        setItems(page.conversations);
        setNextCursor(page.nextCursor);
        setTotal(page.total);
      } catch {
        if (id === requestId.current) setError(errorMessage);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [errorMessage],
  );

  useEffect(() => {
    void load(term);
  }, [load, term]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.listConversations({ search: term, cursor: nextCursor });
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.conversations.filter((item) => !seen.has(item.id))];
      });
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch {
      setError(errorMessage);
    } finally {
      setLoadingMore(false);
    }
  }, [errorMessage, loadingMore, nextCursor, term]);

  const reload = useCallback(() => load(term), [load, term]);

  return {
    search,
    setSearch,
    term,
    items,
    setItems,
    nextCursor,
    total,
    loading,
    loadingMore,
    error,
    loadMore,
    reload,
  };
}
