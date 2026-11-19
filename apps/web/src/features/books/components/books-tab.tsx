import { useState, type RefObject } from "react";
import {
  BookOpen,
  BookUp,
  CircleCheck,
  Pencil,
  Plus,
  Search,
  SearchX,
  Undo2,
} from "lucide-react";
import { CAFE_TIME_ZONE } from "@starter/shared/fnb/domain";
import type { BookDto } from "@starter/shared/fnb/types";
import { BOOK_GENRES } from "@starter/shared/validators/fnb/books";
import { EmptyCard } from "@/features/menu/components/empty-card";
import type { UiState } from "@/features/menu/components/page-state";

export type BookStatus = "on" | "out" | "off";

/** On the shelf, out with a table, or taken off the shelf by the owner. */
export const bookStatus = (b: BookDto): BookStatus =>
  b.loan ? "out" : b.isAvailable ? "on" : "off";

/** Shelf sections: the usual ones first, then any others A→Z. */
export function genresOf(books: BookDto[]) {
  const known: string[] = [...BOOK_GENRES];
  const all = [...new Set(books.map((b) => b.genre))];
  return all.sort((a, b) => {
    const ia = known.indexOf(a);
    const ib = known.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.localeCompare(b, "id");
  });
}

const time = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: CAFE_TIME_ZONE,
});
const day = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: CAFE_TIME_ZONE,
});

/** "14.05" today, "18 Nov 14.05" for an older loan (cafe time zone). */
export function sinceLabel(iso: string) {
  const d = new Date(iso);
  return day.format(d) === day.format(new Date())
    ? time.format(d)
    : `${day.format(d)} ${time.format(d)}`;
}

/** A valid element id for a shelf name ("Anak & Remaja" → "anak-remaja"). */
const genreId = (g: string) =>
  `menu-meja-genre-${g.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export const loanLabel = (l: NonNullable<BookDto["loan"]>) =>
  `Meja ${l.tableNumber}${l.borrowerName ? ` · ${l.borrowerName}` : ""}`;

const mainLabel = (b: BookDto) =>
  `Ubah ${b.title}${b.author ? `, ${b.author}` : ""}${
    b.loan
      ? `, dipinjam ${loanLabel(b.loan)}`
      : b.isAvailable
        ? ""
        : ", nonaktif"
  }`;

export function BooksTab({
  hidden,
  ui,
  patch,
  books,
  searchRef,
  markState,
  onAdd,
  onEdit,
  onToggle,
  onReturn,
}: {
  hidden: boolean;
  ui: UiState;
  patch: (p: Partial<UiState>) => void;
  books: BookDto[];
  searchRef: RefObject<HTMLInputElement | null>;
  markState: (key: string) => "current" | undefined;
  onAdd: (genre?: string) => void;
  onEdit: (id: string) => void;
  onToggle: (book: BookDto, on: boolean) => void;
  onReturn: (book: BookDto) => void;
}) {
  const genres = genresOf(books);
  const genre =
    ui.bGenre !== "all" && genres.includes(ui.bGenre) ? ui.bGenre : "all";
  const inGenre = (g: string) => books.filter((b) => b.genre === g);

  const chips = [{ id: "all", name: "Semua", n: books.length }].concat(
    genres.map((g) => ({ id: g, name: g, n: inGenre(g).length })),
  );
  const pool = genre === "all" ? books : inGenre(genre);
  const countOf = (s: BookStatus) =>
    pool.filter((b) => bookStatus(b) === s).length;
  const statusChips: [UiState["bStatus"], string, number][] = [
    ["all", "Semua", pool.length],
    ["on", "Di rak", countOf("on")],
    ["out", "Dipinjam", countOf("out")],
    ["off", "Nonaktif", countOf("off")],
  ];

  // A card switched on/off stays in place until the filters change (like the
  // Menu tab), so focus stays on its switch.
  const filterKey = `${ui.bq}|${genre}|${ui.bStatus}`;
  const [pin, setPin] = useState({ key: filterKey, ids: new Set<string>() });
  const pinned = pin.key === filterKey ? pin.ids : null;
  const keep = (b: BookDto) =>
    setPin((p) => ({
      key: filterKey,
      ids: new Set(p.key === filterKey ? p.ids : []).add(b.id),
    }));

  const q = ui.bq.trim().toLowerCase();
  const list = books.filter(
    (b) =>
      (genre === "all" || b.genre === genre) &&
      (ui.bStatus === "all" ||
        bookStatus(b) === ui.bStatus ||
        !!pinned?.has(b.id)) &&
      (!q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)),
  );
  const out = books.filter((b) => b.loan);
  const meta =
    list.length === books.length
      ? `${books.length} buku · ${out.length} dipinjam`
      : `Menampilkan ${list.length} dari ${books.length} buku`;

  const showAdd = !q && ui.bStatus === "all";
  const sections = (genre === "all" ? genres : [genre])
    .map((g) => ({ g, items: list.filter((b) => b.genre === g) }))
    .filter(({ items }) => items.length);

  const reset = (
    <button
      type="button"
      className="l-staf-btn"
      onClick={() => {
        patch({ bq: "", bGenre: "all", bStatus: "all" });
        searchRef.current?.focus();
      }}
    >
      Reset filter
    </button>
  );

  return (
    <section
      className="mm-panel"
      id="menu-meja-panel-buku"
      role="tabpanel"
      aria-labelledby="menu-meja-tab-buku"
      hidden={hidden}
    >
      <div className="mm-toolbar">
        <label className="l-staf-search">
          <Search aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Cari judul atau penulis…"
            aria-label="Cari buku"
            autoComplete="off"
            value={ui.bq}
            onChange={(e) => patch({ bq: e.target.value })}
          />
        </label>
        <div
          className="l-staf-seg"
          role="group"
          aria-label="Filter status buku"
        >
          {statusChips.map(([v, label, n]) => (
            <button
              key={v}
              type="button"
              aria-pressed={ui.bStatus === v}
              onClick={() => patch({ bStatus: v })}
            >
              {label}
              <small>{n}</small>
            </button>
          ))}
        </div>
        <span className="mm-meta" aria-live="polite">
          {meta}
        </span>
      </div>
      {genres.length > 1 && (
        <div className="l-staf-seg" role="group" aria-label="Filter genre">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={genre === c.id}
              onClick={() => patch({ bGenre: c.id })}
            >
              {c.name}
              <small>{c.n}</small>
            </button>
          ))}
        </div>
      )}
      {out.length > 0 && ui.bStatus !== "out" && (
        <div>
          <div className="l-staf-alert mm-risk" data-tone="neutral">
            <BookUp aria-hidden="true" style={{ fontSize: 18 }} />
            <div className="mm-grow">
              <strong>{out.length} buku sedang dipinjam pelanggan:</strong>{" "}
              {out
                .slice(0, 4)
                .map((b) => `${b.title} (Meja ${b.loan!.tableNumber})`)
                .join(", ")}
              {out.length > 4 ? `, dan ${out.length - 4} lainnya` : ""}.
            </div>
            <button
              type="button"
              className="l-staf-btn"
              data-size="sm"
              onClick={() => patch({ bStatus: "out", bGenre: "all", bq: "" })}
            >
              Lihat semua
            </button>
          </div>
        </div>
      )}
      <div className="mm-list">
        {!books.length ? (
          <EmptyCard
            icon={BookOpen}
            title="Rak buku masih kosong"
            text="Tambahkan buku pertama. Pelanggan bisa meminjamnya dari aplikasi QR di meja."
            action={
              <button
                type="button"
                className="l-staf-btn"
                data-variant="primary"
                onClick={() => onAdd()}
              >
                <Plus aria-hidden="true" />
                Tambah buku
              </button>
            }
          />
        ) : sections.length ? (
          sections.map(({ g, items }) => (
            <section key={g} className="mm-sec" aria-labelledby={genreId(g)}>
              <header className="mm-sec-head">
                <h2 id={genreId(g)}>{g}</h2>
                <span>{items.length} buku</span>
              </header>
              <div className="mm-grid">
                {items.map((b) => (
                  <BookCard
                    key={b.id}
                    book={b}
                    state={markState(`book:${b.id}`)}
                    onEdit={() => onEdit(b.id)}
                    onToggle={(on) => {
                      keep(b);
                      onToggle(b, on);
                    }}
                    onReturn={() => {
                      keep(b);
                      onReturn(b);
                    }}
                  />
                ))}
                {showAdd && (
                  <button
                    type="button"
                    className="mm-add"
                    onClick={() => onAdd(g)}
                  >
                    <span className="mm-add-plus">
                      <Plus aria-hidden="true" style={{ fontSize: 20 }} />
                    </span>
                    <strong>Tambah buku</strong>
                    <small>ke {g}</small>
                  </button>
                )}
              </div>
            </section>
          ))
        ) : q ? (
          <EmptyCard
            icon={SearchX}
            title="Buku tidak ditemukan"
            text={`Tidak ada buku dengan kata “${ui.bq.trim()}”. Coba judul atau nama penulis lain.`}
            action={reset}
          />
        ) : ui.bStatus === "out" ? (
          <EmptyCard
            icon={CircleCheck}
            title="Semua buku ada di rak"
            text="Belum ada pelanggan yang meminjam buku di pilihan ini."
            action={reset}
          />
        ) : (
          <EmptyCard
            icon={BookOpen}
            title="Tidak ada buku"
            text="Ubah filter, atau tambahkan buku baru."
            action={reset}
          />
        )}
      </div>
    </section>
  );
}

function BookCard({
  book: b,
  state,
  onEdit,
  onToggle,
  onReturn,
}: {
  book: BookDto;
  state: "current" | undefined;
  onEdit: () => void;
  onToggle: (on: boolean) => void;
  onReturn: () => void;
}) {
  const switchId = `menu-meja-book-av-${b.id}`;
  const status = bookStatus(b);
  return (
    <article
      className="mm-card mm-book"
      data-id={b.id}
      data-off={status === "off" ? "" : undefined}
      data-state={state}
    >
      <button
        type="button"
        className="mm-card-main"
        aria-label={mainLabel(b)}
        onClick={onEdit}
      >
        <span className="mm-tile mm-book-tile" aria-hidden="true">
          {b.coverUrl ? (
            <img className="mm-cover" src={b.coverUrl} alt="" loading="lazy" />
          ) : (
            <BookOpen className="mm-cover-none" />
          )}
        </span>
        {status === "out" ? (
          <span className="l-staf-chip mm-sold" data-tone="accent">
            Dipinjam
          </span>
        ) : status === "off" ? (
          <span className="l-staf-chip mm-sold" data-tone="danger">
            Nonaktif
          </span>
        ) : null}
        <span className="mm-card-body">
          <span className="mm-name">{b.title}</span>
          <span className="mm-author">
            {b.author || "Penulis belum diisi"}
            {b.year ? ` · ${b.year}` : ""}
          </span>
          <span className="mm-desc">
            {b.description || "Belum ada sinopsis."}
          </span>
          {b.loan ? (
            <span className="mm-bottom">
              <span className="mm-loan">
                <BookUp aria-hidden="true" style={{ fontSize: 14 }} />
                <span>
                  <b>{loanLabel(b.loan)}</b> · sejak{" "}
                  {sinceLabel(b.loan.borrowedAt)}
                </span>
              </span>
            </span>
          ) : null}
        </span>
      </button>
      <div className="mm-card-foot">
        {b.loan ? (
          <button
            type="button"
            className="l-staf-btn"
            data-size="sm"
            onClick={onReturn}
          >
            <Undo2 aria-hidden="true" />
            Sudah kembali
          </button>
        ) : (
          <div className="mm-avail">
            <label className="l-staf-switch">
              <input
                type="checkbox"
                role="switch"
                id={switchId}
                checked={b.isAvailable}
                onChange={(e) => onToggle(e.target.checked)}
                aria-label={`${b.title} bisa dipinjam`}
              />
              <span />
            </label>
            <label className="mm-avail-txt" htmlFor={switchId}>
              {b.isAvailable ? "Bisa dipinjam" : "Nonaktif"}
            </label>
          </div>
        )}
        <button
          type="button"
          className="l-staf-iconbtn"
          aria-label={`Ubah ${b.title}`}
          title="Ubah buku"
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" style={{ fontSize: 16 }} />
        </button>
      </div>
    </article>
  );
}
