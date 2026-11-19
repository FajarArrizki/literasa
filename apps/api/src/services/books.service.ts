import { and, asc, count, eq, isNull } from "drizzle-orm";
import type { PublicBookDto, PublicBookLoanDto } from "@starter/shared/fnb/api";
import type { BookDto, BookLoanDto } from "@starter/shared/fnb/types";
import {
  MAX_LOANS_PER_TABLE,
  type CreateBookInput,
  type CreateBookLoanInput,
  type UpdateBookInput,
} from "@starter/shared/validators/fnb/books";
import { db } from "../db";
import { bookLoans, books, cafeTables } from "../db/schema";
import { HttpError } from "../lib/http-error";
import { notFound, pgErrorCode, uniqueOr409 } from "../lib/fnb";
import { findActiveTable } from "./tables.service";

/* ---------- Shelf (staff) ---------- */

const bookFields = {
  id: books.id,
  title: books.title,
  author: books.author,
  genre: books.genre,
  year: books.year,
  description: books.description,
  coverUrl: books.coverUrl,
  isAvailable: books.isAvailable,
  createdAt: books.createdAt,
};

const loanFields = {
  id: bookLoans.id,
  bookId: bookLoans.bookId,
  tableNumber: bookLoans.tableNumber,
  borrowerName: bookLoans.borrowerName,
  borrowedAt: bookLoans.borrowedAt,
  returnedAt: bookLoans.returnedAt,
};

type BookRow = typeof books.$inferSelect;
type LoanRow = Pick<typeof bookLoans.$inferSelect, keyof typeof loanFields>;

const toLoan = (l: LoanRow): BookLoanDto => ({
  ...l,
  borrowedAt: l.borrowedAt.toISOString(),
  returnedAt: l.returnedAt?.toISOString() ?? null,
});

const toBook = (
  b: Pick<BookRow, keyof typeof bookFields>,
  loan: LoanRow | null,
): BookDto => ({
  ...b,
  createdAt: b.createdAt.toISOString(),
  loan: loan ? toLoan(loan) : null,
});

/** Every book, shelf by shelf, with the open loan of each book out. */
export async function listBooks(): Promise<BookDto[]> {
  const rows = await db
    .select({ book: bookFields, loan: loanFields })
    .from(books)
    .leftJoin(
      bookLoans,
      and(eq(bookLoans.bookId, books.id), isNull(bookLoans.returnedAt)),
    )
    .orderBy(asc(books.genre), asc(books.createdAt), asc(books.id));
  return rows.map((r) => toBook(r.book, r.loan));
}

async function getBook(id: string): Promise<BookDto> {
  const [row] = await db
    .select({ book: bookFields, loan: loanFields })
    .from(books)
    .leftJoin(
      bookLoans,
      and(eq(bookLoans.bookId, books.id), isNull(bookLoans.returnedAt)),
    )
    .where(eq(books.id, id))
    .limit(1);
  if (!row) throw notFound("Buku");
  return toBook(row.book, row.loan);
}

const DUPLICATE_BOOK = "Buku dengan judul dan penulis ini sudah ada di rak.";

export async function createBook(input: CreateBookInput) {
  const [row] = await uniqueOr409(
    () => db.insert(books).values(input).returning({ id: books.id }),
    DUPLICATE_BOOK,
  );
  return getBook(row!.id);
}

export async function updateBook(id: string, input: UpdateBookInput) {
  const [row] = await uniqueOr409(
    () =>
      db
        .update(books)
        .set(input)
        .where(eq(books.id, id))
        .returning({ id: books.id }),
    DUPLICATE_BOOK,
  );
  if (!row) throw notFound("Buku");
  return getBook(id);
}

/** A book that is out must come back before it can be deleted. */
export async function deleteBook(id: string) {
  return db.transaction(async (tx) => {
    const [book] = await tx
      .select({ id: books.id })
      .from(books)
      .where(eq(books.id, id))
      .for("update");
    if (!book) throw notFound("Buku");
    const [open] = await tx
      .select({ id: bookLoans.id })
      .from(bookLoans)
      .where(and(eq(bookLoans.bookId, id), isNull(bookLoans.returnedAt)))
      .limit(1);
    if (open)
      throw new HttpError(
        409,
        "BOOK_ON_LOAN",
        "Buku ini sedang dipinjam. Tandai dikembalikan dulu sebelum menghapusnya.",
      );
    await tx.delete(books).where(eq(books.id, id));
  });
}

/** Closes the open loan: the book is back on the shelf. */
export async function returnBook(id: string) {
  const [loan] = await db
    .update(bookLoans)
    .set({ returnedAt: new Date() })
    .where(and(eq(bookLoans.bookId, id), isNull(bookLoans.returnedAt)))
    .returning({ id: bookLoans.id });
  if (!loan) {
    await getBook(id); // 404 for an unknown book
    throw new HttpError(
      409,
      "BOOK_NOT_ON_LOAN",
      "Buku ini tidak sedang dipinjam.",
    );
  }
  return getBook(id);
}

/* ---------- Customer QR app ---------- */

export async function listPublicBooks(): Promise<PublicBookDto[]> {
  return (await listBooks()).map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    genre: b.genre,
    year: b.year,
    description: b.description,
    coverUrl: b.coverUrl,
    isAvailable: b.isAvailable,
    loanId: b.loan?.id ?? null,
  }));
}

/**
 * A customer borrows a shelf book from their table. The book must be on the
 * shelf, and a table may hold only a few books at once.
 */
export async function createBookLoan(
  input: CreateBookLoanInput,
): Promise<PublicBookLoanDto> {
  return db.transaction(async (tx) => {
    const table = await findActiveTable(input.qrCode, tx);
    if (!table)
      throw new HttpError(
        404,
        "TABLE_NOT_FOUND",
        "Meja tidak ditemukan atau sedang tidak aktif. Minta bantuan kasir.",
      );
    // Lock the table so parallel requests count each other's loans.
    await tx
      .select({ id: cafeTables.id })
      .from(cafeTables)
      .where(eq(cafeTables.id, table.id))
      .for("update");
    const [book] = await tx
      .select({ id: books.id, isAvailable: books.isAvailable })
      .from(books)
      .where(eq(books.id, input.bookId))
      .for("update");
    if (!book) throw notFound("Buku");
    if (!book.isAvailable)
      throw new HttpError(
        409,
        "BOOK_UNAVAILABLE",
        "Buku ini sedang tidak bisa dipinjam.",
      );
    const [{ open } = { open: 0 }] = await tx
      .select({ open: count() })
      .from(bookLoans)
      .where(
        and(eq(bookLoans.tableId, table.id), isNull(bookLoans.returnedAt)),
      );
    if (open >= MAX_LOANS_PER_TABLE)
      throw new HttpError(
        429,
        "TOO_MANY_LOANS",
        `Satu meja bisa meminjam paling banyak ${MAX_LOANS_PER_TABLE} buku. Kembalikan salah satu dulu ke kasir.`,
      );
    try {
      const [loan] = await tx
        .insert(bookLoans)
        .values({
          bookId: book.id,
          tableId: table.id,
          tableNumber: table.tableNumber,
          borrowerName: input.borrowerName,
        })
        .returning(loanFields);
      return {
        id: loan!.id,
        bookId: loan!.bookId,
        tableNumber: loan!.tableNumber,
        borrowedAt: loan!.borrowedAt.toISOString(),
      };
    } catch (error) {
      if (pgErrorCode(error) === "23505")
        throw new HttpError(
          409,
          "BOOK_ON_LOAN",
          "Yah, buku ini baru saja dipinjam meja lain.",
        );
      throw error;
    }
  });
}
