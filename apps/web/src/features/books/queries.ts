import { queryOptions } from "@tanstack/react-query";
import { listBooks } from "./api";

export const bookKeys = {
  all: ["books"] as const,
  list: () => [...bookKeys.all, "list"] as const,
};

/** Polled, so loans made from customers' phones show up on their own. */
export function booksQuery() {
  return queryOptions({
    queryKey: bookKeys.list(),
    queryFn: listBooks,
    refetchInterval: 20_000,
  });
}
