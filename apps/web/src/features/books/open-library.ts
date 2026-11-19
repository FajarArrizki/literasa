// Book lookup for the "Tambah buku" form: Open Library's free search API
// (no key, CORS open). Called from the owner's browser only.

export type BookLookup = {
  key: string;
  title: string;
  author: string;
  year: number | null;
  coverUrl: string;
};

type SearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
};

export async function searchOpenLibrary(
  query: string,
  signal?: AbortSignal,
): Promise<BookLookup[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "12",
    fields: "key,title,author_name,first_publish_year,cover_i",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const body = (await res.json()) as { docs?: SearchDoc[] };
  return (body.docs ?? [])
    .filter((d) => d.cover_i && d.title)
    .slice(0, 8)
    .map((d) => ({
      key: d.key ?? String(d.cover_i),
      title: d.title!.slice(0, 120),
      author: (d.author_name ?? []).slice(0, 2).join(" & ").slice(0, 80),
      year: d.first_publish_year ?? null,
      coverUrl: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`,
    }));
}
