import { queryOptions } from "@tanstack/react-query";
import { getBooks, getCafe, getMenu } from "./api";

export const catalogKeys = {
  menu: ["menu"] as const,
  cafe: ["cafe"] as const,
  books: ["books"] as const,
};

export const menuQuery = () =>
  queryOptions({ queryKey: catalogKeys.menu, queryFn: getMenu });
export const cafeQuery = () =>
  queryOptions({ queryKey: catalogKeys.cafe, queryFn: getCafe });
/** Polled while open, so a book borrowed at another table greys out. */
export const booksQuery = () =>
  queryOptions({
    queryKey: catalogKeys.books,
    queryFn: getBooks,
    refetchInterval: 30_000,
  });
