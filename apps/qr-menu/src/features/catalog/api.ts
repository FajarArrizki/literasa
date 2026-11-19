import type {
  PublicBookDto,
  PublicBookLoanDto,
  PublicCafeDto,
  PublicMenuDto,
  PublicTableDto,
} from "@starter/shared/fnb/api";
import { publicFetch } from "@/lib/api";

/** GET /api/public/menu: categories in display order, menus, best sellers. */
export async function getMenu() {
  const menu = await publicFetch<PublicMenuDto>("/api/public/menu");
  return {
    ...menu,
    categories: [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

/** GET /api/public/cafe: name, address, opening hours, tax. */
export function getCafe() {
  return publicFetch<PublicCafeDto>("/api/public/cafe");
}

/** GET /api/public/tables/:code: the active table behind a QR (404 otherwise). */
export function getTable(code: string) {
  return publicFetch<PublicTableDto>(
    `/api/public/tables/${encodeURIComponent(code)}`,
  );
}

/** GET /api/public/books: the reading shelf, with which books are out. */
export function getBooks() {
  return publicFetch<PublicBookDto[]>("/api/public/books");
}

/** POST /api/public/book-loans: borrow a shelf book at this table. */
export function borrowBook(input: {
  qrCode: string;
  bookId: string;
  borrowerName: string;
}) {
  return publicFetch<PublicBookLoanDto>("/api/public/book-loans", {
    method: "POST",
    body: input,
  });
}
