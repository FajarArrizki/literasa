import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, Search, SearchX, X } from "lucide-react";
import type { PublicBookDto } from "@starter/shared/fnb/api";
import { MAX_LOANS_PER_TABLE } from "@starter/shared/validators/fnb/books";
import { useBooks, useCafe } from "@/features/catalog/hooks";
import { useCustomerSession } from "@/features/session/store";
import { useToast } from "@/features/browse/components/toast";
import { orderingBlocked, nextOpenLabel } from "@/features/browse/hours";
import { useDocumentTitle } from "@/features/checkout/use-document-title";
import { useNow } from "@/lib/use-now";
import { BookItem } from "./book-item";
import { BookSheet } from "./book-sheet";
import { bookState, genresOf, useMyLoans } from "../shelf";

const ORDER = { mine: 0, shelf: 1, out: 2, off: 3 } as const;

/** "Pinjam Buku": the reading shelf customers borrow from at their table. */
export function BooksPage({ open: initialOpen }: { open?: string }) {
  const { data: cafe } = useCafe();
  const { data: books, dataUpdatedAt } = useBooks();
  const [session] = useCustomerSession();
  const myLoans = useMyLoans(books, dataUpdatedAt);
  const [toastEl, toast] = useToast();
  const now = useNow(30_000);
  const blocked = orderingBlocked(cafe, new Date(now));
  const table = session.table || "–";

  const [genre, setGenre] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(
    initialOpen && books.some((b) => b.id === initialOpen) ? initialOpen : null,
  );
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useDocumentTitle(`Pinjam Buku — ${cafe.cafeName}`);
  useEffect(() => {
    if (!initialOpen) scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
  }, [initialOpen]);

  const genres = genresOf(books);
  const query = q.trim().toLowerCase();
  const match = (b: PublicBookDto) =>
    !query ||
    b.title.toLowerCase().includes(query) ||
    b.author.toLowerCase().includes(query);
  const sections = genres
    .filter((g) => genre === "all" || g === genre)
    .map((g) => ({
      g,
      // Same order as the home strip: mine, on the shelf, then the rest.
      items: books
        .filter((b) => b.genre === g && match(b))
        .sort(
          (a, b) => ORDER[bookState(a, myLoans)] - ORDER[bookState(b, myLoans)],
        ),
    }))
    .filter((s) => s.items.length);
  const onShelf = books.filter((b) => bookState(b, myLoans) === "shelf").length;
  const mine = books.filter((b) => myLoans.has(b.id));
  const opened = openId ? books.find((b) => b.id === openId) : undefined;

  return (
    <main aria-label="Pinjam Buku" className="p-pelanggan">
      <div className="pl-app pl-books-app">
        <header className="pl-head">
          <div className="pl-head-top">
            <Link to="/" className="pl-back" aria-label="Kembali ke menu">
              <ChevronLeft aria-hidden="true" />
              Menu
            </Link>
            <div
              className="pl-table"
              role="group"
              aria-label={`Nomor meja ${table}`}
            >
              <span aria-hidden="true">Meja</span>
              <strong>{table}</strong>
            </div>
          </div>
          <p className="pl-greet pl-books-eyebrow">Pinjam Buku</p>
          <h1 className="pl-thesis" ref={titleRef} tabIndex={-1}>
            Mau baca apa hari ini?
          </h1>
          <div className="pl-meta">
            <span className="pl-chip" data-tone="positive">
              {onShelf} buku di rak
            </span>
            <span className="pl-chip" data-tone="plain">
              Maks. {MAX_LOANS_PER_TABLE} buku per meja
            </span>
          </div>
        </header>

        <label className="pl-search">
          <Search aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Cari judul atau penulis"
            aria-label="Cari buku"
            autoComplete="off"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            className="pl-clear"
            aria-label="Hapus pencarian"
            hidden={!q}
            onClick={(e) => {
              e.preventDefault();
              setQ("");
              searchRef.current?.focus();
            }}
          >
            <X aria-hidden="true" />
          </button>
        </label>

        {mine.length ? (
          <section aria-labelledby="pl-books-mine" className="pl-books-mine">
            <div className="pl-sec">
              <h2 id="pl-books-mine">Sedang kamu baca</h2>
              <span>{mine.length} buku</span>
            </div>
            <BookList books={mine} mine={myLoans} onOpen={setOpenId} />
            <p className="pl-books-note">
              Selesai membaca? Kembalikan bukunya ke kasir ya.
            </p>
          </section>
        ) : null}

        {genres.length > 1 ? (
          <div className="pl-tabs-wrap">
            <div className="pl-tabs" role="tablist" aria-label="Genre buku">
              {[{ id: "all", n: books.length }]
                .concat(
                  genres.map((g) => ({
                    id: g,
                    n: books.filter((b) => b.genre === g).length,
                  })),
                )
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={genre === t.id}
                    onClick={() => setGenre(t.id)}
                  >
                    {t.id === "all" ? "Semua" : t.id}
                    <small>{t.n}</small>
                  </button>
                ))}
            </div>
          </div>
        ) : null}

        <div className="pl-menu">
          {sections.map(({ g, items }) => (
            <section key={g} aria-label={g}>
              <div className="pl-sec">
                <h2>{g}</h2>
                <span>{items.length} buku</span>
              </div>
              <BookList books={items} mine={myLoans} onOpen={setOpenId} />
            </section>
          ))}
          {sections.length ? null : (
            <div className="pl-empty">
              {books.length ? (
                <>
                  <SearchX aria-hidden="true" />
                  <strong>Buku tidak ditemukan</strong>
                  Coba judul atau nama penulis lain.
                </>
              ) : (
                <>
                  <BookOpen aria-hidden="true" />
                  <strong>Rak buku masih kosong</strong>
                  Tanyakan ke kasir buku apa yang bisa dibaca hari ini.
                </>
              )}
            </div>
          )}
        </div>

        <p className="pl-foot">
          Buku hanya dibaca di tempat. Kembalikan ke kasir sebelum pulang.
        </p>
      </div>

      <BookSheet
        book={opened ?? null}
        state={opened ? bookState(opened, myLoans) : "shelf"}
        blocked={blocked}
        closedMsg={`Kafe sedang tutup · buka lagi ${nextOpenLabel(cafe, new Date(now))}`}
        loansAtTable={myLoans.size}
        onClose={() => {
          setOpenId(null);
          // Drop ?buku= so a reload does not reopen the sheet.
          if (initialOpen)
            void navigate({ to: "/buku", search: {}, replace: true });
        }}
        toast={toast}
      />
      {toastEl}
    </main>
  );
}

/** Books listed like menu rows (pl-list card). */
function BookList({
  books,
  mine,
  onOpen,
}: {
  books: PublicBookDto[];
  mine: ReadonlySet<string>;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="pl-list">
      {books.map((b) => (
        <BookItem
          key={b.id}
          book={b}
          state={bookState(b, mine)}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}
