/**
 * Conversation search. SQLite's `like` is case-insensitive for ASCII only, so
 * the searchable text is folded once (lowercase, diacritics stripped, collapsed
 * whitespace) and stored on the row; a query is folded the same way.
 */
export function foldText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function searchTextOf(title: string, bodies: string[]): string {
  return foldText([title, ...bodies].join(" \n ")).slice(0, 20_000);
}

/** Cursor is `<updatedAt>|<id>` so paging stays stable while rows change. */
export function encodeCursor(updatedAt: string, id: string): string {
  return `${updatedAt}|${id}`;
}

export function decodeCursor(cursor: string | null | undefined): { updatedAt: string; id: string } | null {
  if (!cursor) return null;
  const separator = cursor.lastIndexOf("|");
  if (separator <= 0) return null;
  return { updatedAt: cursor.slice(0, separator), id: cursor.slice(separator + 1) };
}
