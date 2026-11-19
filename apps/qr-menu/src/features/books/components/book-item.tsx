import { BookOpen, Plus } from "lucide-react";
import type { PublicBookDto } from "@starter/shared/fnb/api";
import type { BookState } from "../shelf";

const STATE: Record<
  Exclude<BookState, "shelf">,
  { label: string; tone: string; aria: string }
> = {
  mine: { label: "Kamu pinjam", tone: "positive", aria: "sedang kamu pinjam" },
  out: { label: "Dipinjam", tone: "warning", aria: "sedang dipinjam" },
  off: { label: "Tidak tersedia", tone: "danger", aria: "tidak tersedia" },
};

/**
 * One book, built like a menu row (MenuItemBody): cover in the thumb tile,
 * title, synopsis, author where the price goes, and the round button (or a
 * status chip, like "Habis") at the right. Both open the book's sheet.
 */
export function BookItem({
  book: b,
  state: s,
  onOpen,
}: {
  book: PublicBookDto;
  state: BookState;
  onOpen: (id: string) => void;
}) {
  const by = `${b.author}${b.year ? ` · ${b.year}` : ""}`;
  return (
    <li
      className="pl-item pl-book"
      data-state={s}
      data-soldout={s === "out" || s === "off" ? "" : undefined}
    >
      <button
        type="button"
        className="pl-item-main"
        data-open={b.id}
        aria-label={`${b.title}${b.author ? `, ${b.author}` : ""}${
          s === "shelf" ? "" : `, ${STATE[s].aria}`
        }. Lihat detail`}
        onClick={() => onOpen(b.id)}
      >
        <span className="pl-thumb pl-book-thumb" aria-hidden="true">
          {b.coverUrl ? (
            <img src={b.coverUrl} alt="" loading="lazy" />
          ) : (
            <BookOpen />
          )}
        </span>
        <span className="pl-info">
          <span className="pl-name">{b.title}</span>
          <span className="pl-desc">{b.description}</span>
          {by ? <span className="pl-price pl-book-by">{by}</span> : null}
        </span>
      </button>
      {s === "shelf" ? (
        <button
          type="button"
          className="pl-add"
          aria-label={`Pinjam ${b.title}`}
          onClick={() => onOpen(b.id)}
        >
          <Plus aria-hidden="true" style={{ fontSize: 18 }} />
        </button>
      ) : (
        <button
          type="button"
          className="pl-chip pl-sold"
          data-tone={STATE[s].tone}
          aria-label={`${b.title} ${STATE[s].aria}. Lihat detail`}
          onClick={() => onOpen(b.id)}
        >
          {STATE[s].label}
        </button>
      )}
    </li>
  );
}
