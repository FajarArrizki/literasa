import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_LOANS_PER_TABLE } from "@starter/shared/validators/fnb/books";
import { createApp } from "../app";
import { env } from "../config/env";
import { resetRateLimits } from "../lib/rate-limit";
import { agent, originHeader, setRole, signUp } from "./helpers";

const app = createApp();
const QR_ORIGIN = new URL(env.QR_MENU_URL).origin;
const tag = () => randomUUID().slice(0, 8);

async function staff(role: "owner" | "cashier" | null) {
  const client = agent(app);
  const email = await signUp(client, "Staf Buku");
  await setRole(email, role);
  return client;
}

type Client = Awaited<ReturnType<typeof staff>>;

const addBook = (owner: Client, body: object = {}) =>
  owner
    .post("/api/books")
    .set(originHeader)
    .send({ title: `Buku ${tag()}`, genre: "Sastra Indonesia", ...body });

async function activeTable(owner: Client) {
  const res = await owner
    .post("/api/tables")
    .set(originHeader)
    .send({ tableNumber: tag().slice(0, 5).toUpperCase(), area: "Teras" });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; qrCode: string; tableNumber: string };
}

const borrow = (qrCode: string, bookId: string, borrowerName = "") =>
  agent(app)
    .post("/api/public/book-loans")
    .set({ Origin: QR_ORIGIN })
    .send({ qrCode, bookId, borrowerName });

type ShelfBook = {
  id: string;
  loan: { tableNumber: string; borrowerName: string } | null;
};
type PublicBook = { id: string; loanId: string | null; loan?: unknown };

beforeEach(() => resetRateLimits());

describe("Reading shelf", () => {
  it("lets staff read the shelf but only the owner change it", async () => {
    const anonymous = agent(app);
    expect((await anonymous.get("/api/books")).status).toBe(401);
    expect((await (await staff(null)).get("/api/books")).status).toBe(403);

    const cashier = await staff("cashier");
    expect((await cashier.get("/api/books")).status).toBe(200);
    expect((await addBook(cashier)).status).toBe(403);

    const owner = await staff("owner");
    const created = await addBook(owner, {
      author: "Penulis Uji",
      year: 2005,
      description: "  Sinopsis singkat.  ",
      coverUrl: "/covers/laskar-pelangi.jpg",
    });
    expect(created.status).toBe(201);
    expect(created.headers.location).toBe(`/api/books/${created.body.data.id}`);
    expect(created.body.data).toMatchObject({
      author: "Penulis Uji",
      year: 2005,
      description: "Sinopsis singkat.",
      isAvailable: true,
      loan: null,
    });
  });

  it("validates covers, years, and duplicate titles", async () => {
    const owner = await staff("owner");
    expect(
      (await addBook(owner, { coverUrl: "http://x.test/a.jpg" })).status,
    ).toBe(422);
    expect(
      (await addBook(owner, { coverUrl: "javascript:alert(1)" })).status,
    ).toBe(422);
    expect((await addBook(owner, { year: 99 })).status).toBe(422);
    expect((await addBook(owner, { genre: "" })).status).toBe(422);
    expect((await addBook(owner, { isbn: "123" })).status).toBe(422);

    const title = `Judul ${tag()}`;
    expect((await addBook(owner, { title, author: "A" })).status).toBe(201);
    const dup = await addBook(owner, {
      title: title.toUpperCase(),
      author: "a",
    });
    expect(dup.status).toBe(409);
    // Same title by another author is another book.
    expect((await addBook(owner, { title, author: "B" })).status).toBe(201);
  });

  it("lends a book to a table, shows who has it, and takes it back", async () => {
    const owner = await staff("owner");
    const cashier = await staff("cashier");
    const table = await activeTable(owner);
    const book = (await addBook(owner)).body.data as { id: string };

    const loan = await borrow(table.qrCode, book.id, "  Rina ");
    expect(loan.status).toBe(201);
    expect(loan.headers["access-control-allow-origin"]).toBe(QR_ORIGIN);
    expect(loan.body.data).toMatchObject({
      bookId: book.id,
      tableNumber: table.tableNumber,
    });

    // Customers see that it is out, but not who has it.
    const shelf = (await agent(app).get("/api/public/books")).body
      .data as PublicBook[];
    const listed = shelf.find((b) => b.id === book.id)!;
    expect(listed.loanId).toBe(loan.body.data.id);
    expect(listed.loan).toBeUndefined();

    // Staff see the table and name.
    const staffShelf = (await cashier.get("/api/books")).body
      .data as ShelfBook[];
    expect(staffShelf.find((b) => b.id === book.id)!.loan).toMatchObject({
      tableNumber: table.tableNumber,
      borrowerName: "Rina",
    });

    // Out once at a time; it cannot be deleted while out.
    const again = await borrow(table.qrCode, book.id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("BOOK_ON_LOAN");
    const del = await owner.delete(`/api/books/${book.id}`).set(originHeader);
    expect(del.status).toBe(409);

    // Any staff member can take it back, once.
    const back = await cashier
      .post(`/api/books/${book.id}/return`)
      .set(originHeader);
    expect(back.status).toBe(200);
    expect(back.body.data.loan).toBeNull();
    const twice = await cashier
      .post(`/api/books/${book.id}/return`)
      .set(originHeader);
    expect(twice.status).toBe(409);

    expect((await borrow(table.qrCode, book.id)).status).toBe(201);
    await cashier.post(`/api/books/${book.id}/return`).set(originHeader);
    expect(
      (await owner.delete(`/api/books/${book.id}`).set(originHeader)).status,
    ).toBe(204);
    expect(
      (await cashier.post(`/api/books/${book.id}/return`).set(originHeader))
        .status,
    ).toBe(404);
  });

  it("refuses unknown tables, shelved-off books, and too many loans", async () => {
    const owner = await staff("owner");
    const table = await activeTable(owner);
    const book = (await addBook(owner)).body.data as { id: string };

    expect((await borrow("TIDAKADA", book.id)).status).toBe(404);
    expect((await borrow(table.qrCode, "tidak-ada")).status).toBe(404);

    const off = (await addBook(owner, { isAvailable: false })).body.data;
    const refused = await borrow(table.qrCode, off.id);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("BOOK_UNAVAILABLE");

    for (let i = 0; i < MAX_LOANS_PER_TABLE; i++) {
      const b = (await addBook(owner)).body.data;
      expect((await borrow(table.qrCode, b.id)).status).toBe(201);
    }
    const tooMany = await borrow(table.qrCode, book.id);
    expect(tooMany.status).toBe(429);
    expect(tooMany.body.error.code).toBe("TOO_MANY_LOANS");

    // Unknown fields are rejected.
    const extra = await agent(app)
      .post("/api/public/book-loans")
      .set({ Origin: QR_ORIGIN })
      .send({ qrCode: table.qrCode, bookId: book.id, tableNumber: "99" });
    expect(extra.status).toBe(422);
  });

  it("lets the owner edit and shelve off a book", async () => {
    const owner = await staff("owner");
    const book = (await addBook(owner)).body.data as { id: string };
    const edited = await owner
      .patch(`/api/books/${book.id}`)
      .set(originHeader)
      .send({ genre: "Nonfiksi", isAvailable: false, year: null });
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({
      genre: "Nonfiksi",
      isAvailable: false,
      year: null,
    });
    const empty = await owner
      .patch(`/api/books/${book.id}`)
      .set(originHeader)
      .send({});
    expect(empty.status).toBe(422);
    expect(
      (
        await owner
          .patch("/api/books/tidak-ada")
          .set(originHeader)
          .send({ title: "X" })
      ).status,
    ).toBe(404);
  });
});
