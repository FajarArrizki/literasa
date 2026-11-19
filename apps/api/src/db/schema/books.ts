import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { textId } from "./_id";
import { cafeTables } from "./tables";

// Literasa's reading shelf: books customers can borrow while at a table.
export const books = pgTable(
  "books",
  {
    id: textId(),
    title: text("title").notNull(),
    author: text("author").notNull().default(""),
    genre: text("genre").notNull(),
    year: integer("year"),
    description: text("description").notNull().default(""),
    // "/covers/<file>.jpg" bundled with the apps, or an https image URL.
    coverUrl: text("cover_url").notNull().default(""),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("books_title_author_uq").on(
      sql`lower(${t.title})`,
      sql`lower(${t.author})`,
    ),
  ],
);

// One row per borrowing. returned_at is null while the book is out; the
// partial unique index allows only one open loan per book.
export const bookLoans = pgTable(
  "book_loans",
  {
    id: textId(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    tableId: text("table_id").references(() => cafeTables.id, {
      onDelete: "set null",
    }),
    // Copied so history keeps the number after a table is renamed or removed.
    tableNumber: text("table_number").notNull(),
    borrowerName: text("borrower_name").notNull().default(""),
    borrowedAt: timestamp("borrowed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("book_loans_open_uq")
      .on(t.bookId)
      .where(sql`${t.returnedAt} IS NULL`),
    index("book_loans_table_idx").on(t.tableId),
  ],
);
