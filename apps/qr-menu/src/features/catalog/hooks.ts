import { useSuspenseQuery } from "@tanstack/react-query";
import { booksQuery, cafeQuery, menuQuery } from "./queries";

export const useMenu = () => useSuspenseQuery(menuQuery());
export const useCafe = () => useSuspenseQuery(cafeQuery());
export const useBooks = () => useSuspenseQuery(booksQuery());
