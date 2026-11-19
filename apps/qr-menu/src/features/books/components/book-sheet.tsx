import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CircleCheck, Clock, Info, X } from "lucide-react";
import type { PublicBookDto } from "@starter/shared/fnb/api";
import { hhmm } from "@starter/shared/fnb/domain";
import { MAX_LOANS_PER_TABLE } from "@starter/shared/validators/fnb/books";
import { borrowBook } from "@/features/catalog/api";
import { catalogKeys } from "@/features/catalog/queries";
import { useCustomerSession } from "@/features/session/store";
import { ApiError } from "@/lib/api";
import type { BookState } from "../shelf";

/** Bottom sheet with the book's details and the "Pinjam" form. */
export function BookSheet({
  book,
  state,
  blocked,
  closedMsg,
  loansAtTable,
  onClose,
  toast,
}: {
  book: PublicBookDto | null;
  state: BookState;
  /** Cafe closed: borrowing waits until it opens. */
  blocked: boolean;
  closedMsg: string;
  /** Books this phone already has out. */
  loansAtTable: number;
  onClose: () => void;
  toast: (text: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [session, update] = useCustomerSession();
  const qc = useQueryClient();
  const borrow = useMutation({ mutationFn: borrowBook });
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (book && !el.open) {
      setError("");
      el.showModal();
    }
    if (!book && el.open) el.close();
  }, [book]);

  const full = loansAtTable >= MAX_LOANS_PER_TABLE;
  const myLoan = book
    ? session.loans.find((l) => l.bookId === book.id)
    : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!book || borrow.isPending) return;
    if (blocked) return setError(closedMsg);
    setError("");
    try {
      const loan = await borrow.mutateAsync({
        qrCode: session.qr || session.table,
        bookId: book.id,
        borrowerName: name.trim(),
      });
      update((d) => {
        d.loans = [
          ...d.loans.filter((l) => l.bookId !== book.id),
          {
            id: loan.id,
            bookId: loan.bookId,
            borrowedAt: loan.borrowedAt,
            at: Date.now(),
          },
        ];
      });
      await qc.invalidateQueries({ queryKey: catalogKeys.books });
      onClose();
      toast(`✓ “${book.title}” dipinjam untuk Meja ${loan.tableNumber}`);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Gagal meminjam. Coba lagi.",
      );
      if (err instanceof ApiError && err.status === 409)
        void qc.invalidateQueries({ queryKey: catalogKeys.books });
    }
  }

  return (
    <dialog
      ref={ref}
      className="pl-sheet"
      aria-labelledby="pl-sheet-title"
      onClose={onClose}
      onClick={(e) => {
        // A tap on the dimmed backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {book ? (
        <form className="pl-sheet-body" noValidate onSubmit={submit}>
          <span className="pl-sheet-grip" aria-hidden="true" />
          <button
            type="button"
            className="pl-sheet-x"
            aria-label="Tutup"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
          <div className="pl-sheet-top">
            <span className="pl-sheet-cover" aria-hidden="true">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt="" />
              ) : (
                <BookOpen />
              )}
            </span>
            <div className="pl-sheet-meta">
              <span className="pl-tag">{book.genre}</span>
              <h2 id="pl-sheet-title">{book.title}</h2>
              <p className="pl-author">
                {book.author}
                {book.year ? ` · ${book.year}` : ""}
              </p>
            </div>
          </div>
          {book.description ? (
            <p className="pl-sheet-desc">{book.description}</p>
          ) : null}

          {state === "mine" ? (
            <p className="pl-sheet-note" data-tone="positive">
              <CircleCheck aria-hidden="true" />
              <span>
                <strong>Sedang kamu pinjam</strong>
                {myLoan ? ` sejak ${hhmm(myLoan.borrowedAt)}` : ""}. Selamat
                membaca! Kembalikan ke kasir setelah selesai.
              </span>
            </p>
          ) : state === "out" ? (
            <p className="pl-sheet-note" data-tone="warning">
              <Clock aria-hidden="true" />
              <span>
                <strong>Sedang dipinjam pelanggan lain.</strong> Coba lagi
                nanti, atau pilih buku lain dulu.
              </span>
            </p>
          ) : state === "off" ? (
            <p className="pl-sheet-note" data-tone="danger">
              <Info aria-hidden="true" />
              <span>
                <strong>Buku ini sedang tidak bisa dipinjam.</strong> Tanyakan
                ke kasir untuk rekomendasi lain.
              </span>
            </p>
          ) : (
            <>
              <label className="pl-field">
                <span>
                  Nama kamu <small>(opsional)</small>
                </span>
                <input
                  type="text"
                  maxLength={40}
                  autoComplete="given-name"
                  placeholder="Supaya kasir tahu siapa yang meminjam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {blocked ? (
                <p className="pl-sheet-note" data-tone="warning">
                  <Clock aria-hidden="true" />
                  <span>{closedMsg}</span>
                </p>
              ) : full ? (
                <p className="pl-sheet-note" data-tone="warning">
                  <Info aria-hidden="true" />
                  <span>
                    Kamu sudah meminjam {MAX_LOANS_PER_TABLE} buku. Kembalikan
                    salah satu ke kasir dulu, ya.
                  </span>
                </p>
              ) : (
                <p className="pl-sheet-hint">
                  Ambil bukunya di rak baca, lalu kembalikan ke kasir setelah
                  selesai membaca.
                </p>
              )}
              {error ? (
                <p className="pl-sheet-err" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="pl-cta"
                disabled={borrow.isPending || blocked || full}
              >
                {borrow.isPending ? "Meminjam…" : "Pinjam buku ini"}
              </button>
            </>
          )}
        </form>
      ) : null}
    </dialog>
  );
}
