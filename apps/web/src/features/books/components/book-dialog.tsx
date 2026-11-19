import { useRef, useState, type FormEvent } from "react";
import {
  BookOpen,
  BookUp,
  LoaderCircle,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { BookDto } from "@starter/shared/fnb/types";
import { BOOK_GENRES } from "@starter/shared/validators/fnb/books";
import { Dialog, useToast } from "@/components/fnb/dialog";
import {
  errorMessage,
  errorStatus,
} from "@/features/menu/components/page-state";
import { useSaveBook } from "../hooks";
import { searchOpenLibrary, type BookLookup } from "../open-library";
import { genresOf, loanLabel, sinceLabel } from "./books-tab";

export type BookDialogTarget = { id: string | null; presetGenre?: string };

export function BookDialog({
  target,
  onClose,
  ...props
}: {
  target: BookDialogTarget | null;
  onClose: () => void;
} & Omit<BookFormProps, "target" | "onClose">) {
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      size="lg"
      labelledBy="menu-meja-bk-title"
    >
      {target && <BookForm target={target} onClose={onClose} {...props} />}
    </Dialog>
  );
}

type FieldErrors = {
  title?: string;
  genre?: string;
  year?: string;
  cover?: string;
};

type BookFormProps = {
  target: BookDialogTarget;
  books: BookDto[];
  /** Genre filter on the Buku tab, the default for a new book. */
  filterGenre: string;
  onClose: () => void;
  onSaved: (book: BookDto, isNew: boolean) => void;
  onDelete: (book: BookDto) => void;
  onReturn: (book: BookDto) => void;
};

const COVER_OK = (v: string) =>
  v === "" ||
  /^\/covers\/[a-z0-9-]+\.(jpg|png|webp)$/.test(v) ||
  /^https:\/\/\S+$/i.test(v);

function BookForm({
  target,
  books,
  filterGenre,
  onClose,
  onSaved,
  onDelete,
  onReturn,
}: BookFormProps) {
  const toast = useToast();
  const save = useSaveBook();
  const b = target.id ? books.find((x) => x.id === target.id) : undefined;

  const [title, setTitle] = useState(b?.title ?? "");
  const [author, setAuthor] = useState(b?.author ?? "");
  const [genre, setGenre] = useState(
    () =>
      b?.genre ??
      target.presetGenre ??
      (filterGenre !== "all" ? filterGenre : BOOK_GENRES[0]),
  );
  const [year, setYear] = useState(b?.year ? String(b.year) : "");
  const [desc, setDesc] = useState(b?.description ?? "");
  const [cover, setCover] = useState(b?.coverUrl ?? "");
  const [avail, setAvail] = useState(b ? b.isAvailable : true);
  const [errs, setErrs] = useState<FieldErrors>({});
  const [coverBroken, setCoverBroken] = useState(false);

  const genreOptions = [...new Set([...BOOK_GENRES, ...genresOf(books)])];

  /* ----- Open Library lookup ----- */
  const [q, setQ] = useState("");
  const [found, setFound] = useState<BookLookup[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const abort = useRef<AbortController | null>(null);

  async function lookup() {
    const query = (q.trim() || title.trim()).slice(0, 100);
    if (!query) {
      setLookupError("Ketik judul atau nama penulis dulu.");
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setSearching(true);
    setLookupError("");
    try {
      const list = await searchOpenLibrary(query, ctrl.signal);
      setFound(list);
      if (!list.length)
        setLookupError(
          `Tidak ada hasil bercover untuk “${query}”. Coba kata lain, atau isi manual.`,
        );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setFound(null);
      setLookupError(
        "Pencarian gagal. Cek koneksi internet, atau isi data buku secara manual.",
      );
    } finally {
      if (abort.current === ctrl) setSearching(false);
    }
  }

  function pick(r: BookLookup) {
    setTitle(r.title);
    if (r.author) setAuthor(r.author);
    if (r.year) setYear(String(r.year));
    setCover(r.coverUrl);
    setCoverBroken(false);
    setErrs((e) => ({
      ...e,
      title: undefined,
      year: undefined,
      cover: undefined,
    }));
    toast(`Data “${r.title}” dipakai — cek lagi sebelum disimpan`);
  }

  /* ----- Submit ----- */
  async function submit(e: FormEvent) {
    e.preventDefault();
    const fe: FieldErrors = {};
    const bad: string[] = [];
    const cleanTitle = title.trim().replace(/\s+/g, " ");
    const cleanAuthor = author.trim().replace(/\s+/g, " ");
    const cleanGenre = genre.trim().replace(/\s+/g, " ");
    if (!cleanTitle) fe.title = "Judul buku wajib diisi.";
    else if (
      books.some(
        (x) =>
          x.id !== target.id &&
          x.title.toLowerCase() === cleanTitle.toLowerCase() &&
          x.author.toLowerCase() === cleanAuthor.toLowerCase(),
      )
    )
      fe.title = `“${cleanTitle}” sudah ada di rak.`;
    if (fe.title) bad.push("menu-meja-bk-title-in");
    if (!cleanGenre) {
      fe.genre = "Isi genre / rak buku.";
      bad.push("menu-meja-bk-genre");
    }
    const yearNum = year.trim() ? Number(year.trim()) : null;
    if (
      yearNum !== null &&
      (!Number.isInteger(yearNum) || yearNum < 1000 || yearNum > 2100)
    ) {
      fe.year = "Isi tahun 4 angka, mis. 2005.";
      bad.push("menu-meja-bk-year");
    }
    const cleanCover = cover.trim();
    if (!COVER_OK(cleanCover)) {
      fe.cover = "Alamat gambar harus diawali https://";
      bad.push("menu-meja-bk-cover");
    }
    setErrs(fe);
    if (bad[0]) {
      document.getElementById(bad[0])?.focus();
      toast("Periksa lagi isian yang ditandai merah");
      return;
    }
    try {
      const saved = await save.mutateAsync({
        id: b?.id ?? null,
        input: {
          title: cleanTitle,
          author: cleanAuthor,
          genre: cleanGenre,
          year: yearNum,
          description: desc.trim(),
          coverUrl: cleanCover,
          isAvailable: avail,
        },
      });
      onSaved(saved, !b);
    } catch (err) {
      if (errorStatus(err) === 409) {
        setErrs({ title: errorMessage(err) });
        document.getElementById("menu-meja-bk-title-in")?.focus();
      } else toast(errorMessage(err));
    }
  }

  const showCover = cover.trim() && COVER_OK(cover.trim()) && !coverBroken;

  return (
    <form className="mm-form" noValidate onSubmit={submit}>
      <div className="l-staf-dialog-head">
        <div>
          <h2 id="menu-meja-bk-title">{b ? "Ubah buku" : "Tambah buku"}</h2>
          <p>
            {b
              ? "Perubahan langsung tampil di aplikasi pelanggan."
              : "Buku baru langsung bisa dipinjam dari aplikasi QR setelah disimpan."}
          </p>
        </div>
        <button
          className="l-staf-iconbtn"
          type="button"
          aria-label="Tutup"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="l-staf-dialog-body">
        {b?.loan ? (
          <div className="l-staf-alert mm-bk-loan" data-tone="neutral">
            <BookUp aria-hidden="true" style={{ fontSize: 18 }} />
            <div className="mm-grow">
              <strong>Sedang dipinjam {loanLabel(b.loan)}</strong> · sejak{" "}
              {sinceLabel(b.loan.borrowedAt)}
            </div>
            <button
              type="button"
              className="l-staf-btn"
              data-size="sm"
              onClick={() => onReturn(b)}
            >
              <Undo2 aria-hidden="true" />
              Sudah kembali
            </button>
          </div>
        ) : null}
        <div className="mm-mgrid">
          <div className="mm-photo">
            <div className="mm-photo-prev mm-bk-prev">
              {showCover ? (
                <img
                  src={cover.trim()}
                  alt=""
                  onError={() => setCoverBroken(true)}
                />
              ) : (
                <span className="mm-bk-none" aria-hidden="true">
                  <BookOpen />
                  <span>
                    {coverBroken
                      ? "Gambar tidak bisa dimuat"
                      : "Belum ada cover"}
                  </span>
                </span>
              )}
              <small>Pratinjau</small>
            </div>
            <div className="l-staf-field">
              <label htmlFor="menu-meja-bk-cover">
                Alamat gambar cover <span className="mm-opt">(opsional)</span>
              </label>
              <input
                className="l-staf-input"
                id="menu-meja-bk-cover"
                autoComplete="off"
                inputMode="url"
                placeholder="https://…"
                aria-describedby="menu-meja-bk-cover-err"
                aria-invalid={errs.cover ? true : undefined}
                value={cover}
                onChange={(e) => {
                  setCover(e.target.value);
                  setCoverBroken(false);
                  setErrs((x) => ({ ...x, cover: undefined }));
                }}
              />
              <p
                className="l-staf-error"
                id="menu-meja-bk-cover-err"
                hidden={!errs.cover}
              >
                {errs.cover}
              </p>
            </div>
          </div>

          <div className="mm-fgrid">
            <div className="l-staf-field mm-span2">
              <label htmlFor="menu-meja-bk-title-in">Judul buku</label>
              <input
                data-autofocus
                className="l-staf-input"
                id="menu-meja-bk-title-in"
                maxLength={120}
                autoComplete="off"
                placeholder="Contoh: Laskar Pelangi"
                aria-describedby="menu-meja-bk-title-err"
                aria-invalid={errs.title ? true : undefined}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrs((x) => ({ ...x, title: undefined }));
                }}
              />
              <p
                className="l-staf-error"
                id="menu-meja-bk-title-err"
                hidden={!errs.title}
              >
                {errs.title}
              </p>
            </div>
            <div className="l-staf-field mm-span2">
              <label htmlFor="menu-meja-bk-author">
                Penulis <span className="mm-opt">(opsional)</span>
              </label>
              <input
                className="l-staf-input"
                id="menu-meja-bk-author"
                maxLength={80}
                autoComplete="off"
                placeholder="Contoh: Andrea Hirata"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
            <div className="l-staf-field">
              <label htmlFor="menu-meja-bk-genre">Genre / rak</label>
              <input
                className="l-staf-input"
                id="menu-meja-bk-genre"
                list="menu-meja-bk-genres"
                maxLength={40}
                autoComplete="off"
                aria-describedby="menu-meja-bk-genre-err"
                aria-invalid={errs.genre ? true : undefined}
                value={genre}
                onChange={(e) => {
                  setGenre(e.target.value);
                  setErrs((x) => ({ ...x, genre: undefined }));
                }}
              />
              <datalist id="menu-meja-bk-genres">
                {genreOptions.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              <p
                className="l-staf-error"
                id="menu-meja-bk-genre-err"
                hidden={!errs.genre}
              >
                {errs.genre}
              </p>
            </div>
            <div className="l-staf-field">
              <label htmlFor="menu-meja-bk-year">
                Tahun terbit <span className="mm-opt">(opsional)</span>
              </label>
              <input
                className="l-staf-input"
                id="menu-meja-bk-year"
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                placeholder="2005"
                aria-describedby="menu-meja-bk-year-err"
                aria-invalid={errs.year ? true : undefined}
                value={year}
                onChange={(e) => {
                  setYear(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setErrs((x) => ({ ...x, year: undefined }));
                }}
              />
              <p
                className="l-staf-error"
                id="menu-meja-bk-year-err"
                hidden={!errs.year}
              >
                {errs.year}
              </p>
            </div>
            <div className="l-staf-field mm-span2">
              <label htmlFor="menu-meja-bk-desc">
                Sinopsis singkat <span className="mm-opt">(opsional)</span>
              </label>
              <textarea
                className="l-staf-textarea"
                id="menu-meja-bk-desc"
                rows={3}
                maxLength={300}
                placeholder="Ceritakan singkat isi bukunya untuk pelanggan."
                aria-describedby="menu-meja-bk-desc-count"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <p className="l-staf-hint mm-count" id="menu-meja-bk-desc-count">
                <span>{desc.length}</span>/300
              </p>
            </div>
            <div className="mm-switch-row mm-span2">
              <label className="l-staf-switch">
                <input
                  type="checkbox"
                  role="switch"
                  id="menu-meja-bk-avail"
                  checked={avail}
                  onChange={(e) => setAvail(e.target.checked)}
                />
                <span />
              </label>
              <label htmlFor="menu-meja-bk-avail">
                <strong>Bisa dipinjam pelanggan</strong>
                <small>
                  {avail
                    ? "Tampil di aplikasi QR dan bisa dipinjam dari meja."
                    : "Tampil sebagai “Tidak tersedia” — mis. sedang rusak atau hilang."}
                </small>
              </label>
            </div>
          </div>
        </div>

        <section className="mm-recipe" aria-labelledby="menu-meja-ol-title">
          <div className="mm-recipe-head">
            <div>
              <h3 id="menu-meja-ol-title">Cari data &amp; cover otomatis</h3>
              <p>
                Dari katalog gratis Open Library. Pilih salah satu hasil untuk
                mengisi judul, penulis, tahun, dan cover.
              </p>
            </div>
          </div>
          <div className="mm-ol-bar">
            <label className="l-staf-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                aria-label="Cari buku di Open Library"
                placeholder={
                  title.trim() || "Judul atau penulis, mis. Bumi Manusia"
                }
                autoComplete="off"
                enterKeyHint="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void lookup();
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="l-staf-btn"
              onClick={() => void lookup()}
              disabled={searching}
            >
              {searching ? (
                <LoaderCircle aria-hidden="true" className="mm-spin" />
              ) : (
                <Search aria-hidden="true" />
              )}
              Cari
            </button>
          </div>
          <p className="l-staf-hint" aria-live="polite" hidden={!lookupError}>
            {lookupError}
          </p>
          {found?.length ? (
            <ul className="mm-ol-results" aria-label="Hasil pencarian">
              {found.map((r) => (
                <li key={r.key}>
                  <button
                    type="button"
                    aria-pressed={cover === r.coverUrl}
                    onClick={() => pick(r)}
                  >
                    <img
                      src={r.coverUrl.replace("-L.jpg", "-M.jpg")}
                      alt=""
                      loading="lazy"
                    />
                    <strong>{r.title}</strong>
                    <small>
                      {r.author || "Tanpa nama penulis"}
                      {r.year ? ` · ${r.year}` : ""}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
      <div className="l-staf-dialog-foot">
        <button
          type="button"
          className="l-staf-btn"
          data-variant="danger"
          hidden={!b}
          onClick={() => b && onDelete(b)}
        >
          <Trash2 aria-hidden="true" />
          Hapus buku
        </button>
        <span className="mm-grow" />
        <button type="button" className="l-staf-btn" onClick={onClose}>
          Batal
        </button>
        <button
          type="submit"
          className="l-staf-btn"
          data-variant="primary"
          disabled={save.isPending}
        >
          {b ? "Simpan perubahan" : "Simpan buku"}
        </button>
      </div>
    </form>
  );
}
