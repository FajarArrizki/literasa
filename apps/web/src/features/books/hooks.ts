import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { deleteBook, returnBook, saveBook, setBookAvailability } from "./api";
import { bookKeys, booksQuery } from "./queries";

export function useBooks() {
  return useSuspenseQuery(booksQuery());
}

// Mutations resolve after the refetch, so callers can focus/mark the updated
// card right after `await mutateAsync(…)`.

export function useSaveBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveBook,
    onSuccess: () => qc.invalidateQueries({ queryKey: bookKeys.all }),
  });
}

/** Optimistic, so the switch moves immediately (like the menu switch). */
export function useSetBookAvailability() {
  const qc = useQueryClient();
  const key = booksQuery().queryKey;
  return useMutation({
    mutationFn: setBookAvailability,
    onMutate: async ({ id, isAvailable }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (list) =>
        list?.map((b) => (b.id === id ? { ...b, isAvailable } : b)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: bookKeys.all }),
  });
}

export function useReturnBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: returnBook,
    onSuccess: () => qc.invalidateQueries({ queryKey: bookKeys.all }),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBook,
    onSuccess: () => qc.invalidateQueries({ queryKey: bookKeys.all }),
  });
}
