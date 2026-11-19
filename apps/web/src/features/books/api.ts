import type { BookDto } from "@starter/shared/fnb/types";
import type { DataResponse } from "@starter/shared/types";
import { apiFetch } from "@/lib/api/client";

// /api/books: the reading shelf customers borrow from at their table.

const bookPath = (id: string) => `/api/books/${encodeURIComponent(id)}`;

export async function listBooks() {
  return (await apiFetch<DataResponse<BookDto[]>>("/api/books")).data;
}

export type BookInput = {
  title: string;
  author: string;
  genre: string;
  year: number | null;
  description: string;
  coverUrl: string;
  isAvailable: boolean;
};

/** POST /api/books (id = null) or PATCH /api/books/:id */
export async function saveBook({
  id,
  input,
}: {
  id: string | null;
  input: BookInput;
}) {
  const res = await apiFetch<DataResponse<BookDto>>(
    id ? bookPath(id) : "/api/books",
    { method: id ? "PATCH" : "POST", body: input },
  );
  return res.data;
}

/** PATCH /api/books/:id { isAvailable } */
export async function setBookAvailability({
  id,
  isAvailable,
}: {
  id: string;
  isAvailable: boolean;
}) {
  const res = await apiFetch<DataResponse<BookDto>>(bookPath(id), {
    method: "PATCH",
    body: { isAvailable },
  });
  return res.data;
}

/** POST /api/books/:id/return: the borrowed book is back on the shelf. */
export async function returnBook(id: string) {
  const res = await apiFetch<DataResponse<BookDto>>(`${bookPath(id)}/return`, {
    method: "POST",
  });
  return res.data;
}

/** DELETE /api/books/:id (409 while the book is out). */
export async function deleteBook(id: string) {
  await apiFetch<void>(bookPath(id), { method: "DELETE" });
}
