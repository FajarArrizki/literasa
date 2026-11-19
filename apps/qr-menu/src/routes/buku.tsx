import { createFileRoute, redirect } from "@tanstack/react-router";
import { BooksPage } from "@/features/books/components/books-page";
import { booksQuery, cafeQuery } from "@/features/catalog/queries";
import { readSession } from "@/features/session/store";

// "Pinjam Buku": the reading shelf. Client-only like the other customer
// screens: the table and the books borrowed from this phone live in
// localStorage. ?buku=<id> opens that book's sheet (from the home strip).
export const Route = createFileRoute("/buku")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { buku?: string } =>
    search.buku == null ? {} : { buku: String(search.buku).slice(0, 64) },
  beforeLoad: ({ preload }) => {
    // Borrowing needs a table: without a scanned QR, start at the menu.
    if (!preload && !readSession().table)
      throw redirect({ to: "/", replace: true });
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(cafeQuery()),
      context.queryClient.ensureQueryData(booksQuery()),
    ]),
  component: Page,
});

function Page() {
  const { buku } = Route.useSearch();
  return (
    <div data-page="pelanggan">
      <BooksPage open={buku} />
    </div>
  );
}
