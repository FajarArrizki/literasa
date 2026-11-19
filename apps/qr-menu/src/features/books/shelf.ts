import { useEffect } from "react";
import type { PublicBookDto } from "@starter/shared/fnb/api";
import { BOOK_GENRES } from "@starter/shared/validators/fnb/books";
import { useCustomerSession } from "@/features/session/store";

/** Mine (borrowed from this phone), out with someone else, off, or on the shelf. */
export type BookState = "mine" | "out" | "off" | "shelf";

export const bookState = (
  b: PublicBookDto,
  mine: ReadonlySet<string>,
): BookState =>
  mine.has(b.id) ? "mine" : b.loanId ? "out" : b.isAvailable ? "shelf" : "off";

/** Shelf sections: the usual ones first, then any others A→Z. */
export function genresOf(books: { genre: string }[]) {
  const known: string[] = [...BOOK_GENRES];
  return [...new Set(books.map((b) => b.genre))].sort((a, b) => {
    const ia = known.indexOf(a);
    const ib = known.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.localeCompare(b, "id");
  });
}

/**
 * Ids of the books this phone borrowed that are still out on that same loan.
 * A loan newer than the shelf data counts as out until the next refetch;
 * loans the cashier has closed are then dropped from the session.
 */
export function useMyLoans(books: PublicBookDto[], dataUpdatedAt: number) {
  const [session, update] = useCustomerSession();
  const open = new Map(
    books.flatMap((b) => (b.loanId ? [[b.loanId, b.id] as const] : [])),
  );
  const live = session.loans.filter(
    (l) => open.get(l.id) === l.bookId || !(dataUpdatedAt > (l.at ?? 0)),
  );
  const liveKey = live.map((l) => l.id).join(",");
  const stale = live.length !== session.loans.length;
  useEffect(() => {
    if (!stale) return;
    const keep = new Set(liveKey.split(","));
    update((d) => {
      d.loans = d.loans.filter((l) => keep.has(l.id));
    });
  }, [stale, liveKey, update]);
  return new Set(live.map((l) => l.bookId));
}
