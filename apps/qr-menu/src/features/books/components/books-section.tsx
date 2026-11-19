import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useBooks } from "@/features/catalog/hooks";
import { bookState, genresOf, useMyLoans } from "../shelf";
import { BookItem } from "./book-item";

const ORDER = { mine: 0, shelf: 1, out: 2, off: 3 } as const;
const SHOWN = 3;

/** Home-screen section, styled like a menu category: a few books, then "Semua". */
export function BooksSection() {
  const navigate = useNavigate();
  const { data: books, dataUpdatedAt } = useBooks();
  const mine = useMyLoans(books, dataUpdatedAt);
  if (!books.length) return null;
  // Borrowed-by-me first, then what is on the shelf, then the rest; shelf
  // by shelf in the usual order (Sastra Indonesia first).
  const genres = genresOf(books);
  const rank = (b: (typeof books)[number]) =>
    ORDER[bookState(b, mine)] * 100 + genres.indexOf(b.genre);
  const shown = [...books].sort((a, b) => rank(a) - rank(b)).slice(0, SHOWN);
  const open = (id: string) =>
    void navigate({ to: "/buku", search: { buku: id } });
  return (
    <section aria-labelledby="pelanggan-books-title" className="pl-books-sec">
      <div className="pl-sec">
        <h2 id="pelanggan-books-title">Pinjam buku</h2>
        <Link to="/buku" className="pl-sec-link">
          Semua {books.length}
          <ChevronRight aria-hidden="true" />
        </Link>
      </div>
      <ul className="pl-list">
        {shown.map((b) => (
          <BookItem
            key={b.id}
            book={b}
            state={bookState(b, mine)}
            onOpen={open}
          />
        ))}
      </ul>
    </section>
  );
}
