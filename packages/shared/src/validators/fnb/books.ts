import { z } from "zod";
import { recordIdSchema, text } from "./common";

/** Shelf sections offered in the book form (any other name is allowed too). */
export const BOOK_GENRES = [
  "Sastra Indonesia",
  "Fiksi Dunia",
  "Pengembangan Diri",
  "Nonfiksi",
  "Anak & Remaja",
  "Komik",
] as const;

/** At most this many books out at once per table. */
export const MAX_LOANS_PER_TABLE = 3;

/** A bundled cover ("/covers/laskar-pelangi.jpg") or an https image URL. */
const coverUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      v === "" ||
      /^\/covers\/[a-z0-9-]+\.(jpg|png|webp)$/.test(v) ||
      /^https:\/\/[^\s]+$/i.test(v),
    "Pakai alamat gambar yang diawali https://.",
  );

const year = z
  .number()
  .int()
  .min(1000, "Tahun terbit tidak valid.")
  .max(2100, "Tahun terbit tidak valid.")
  .nullable();

const bookFields = {
  title: text(120).min(1, "Judul buku wajib diisi."),
  author: text(80).default(""),
  genre: text(40).min(1, "Isi genre / rak buku."),
  year: year.default(null),
  description: text(300).default(""),
  coverUrl: coverUrl.default(""),
  isAvailable: z.boolean().default(true),
};

export const createBookSchema = z.object(bookFields).strict();

export const updateBookSchema = z
  .object({
    title: bookFields.title.optional(),
    author: text(80).optional(),
    genre: bookFields.genre.optional(),
    year: year.optional(),
    description: text(300).optional(),
    coverUrl: coverUrl.optional(),
    isAvailable: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) => Object.values(v).some((x) => x !== undefined),
    "Provide a field to update.",
  );

/**
 * POST /api/public/book-loans: a customer borrows a shelf book at their table.
 * `qrCode` is what the table QR carried (token or table number), as for orders.
 */
export const createBookLoanSchema = z
  .object({
    qrCode: recordIdSchema,
    bookId: recordIdSchema,
    borrowerName: text(40).default(""),
  })
  .strict();

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type CreateBookLoanInput = z.infer<typeof createBookLoanSchema>;
