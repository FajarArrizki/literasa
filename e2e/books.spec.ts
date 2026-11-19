import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  API_URL,
  authPost,
  OWNER_EMAIL,
  PASSWORD,
  fitsWidth,
  headers,
  owner,
} from "./helpers";

test("the owner sees borrowed books, takes them back, and adds new ones", async ({
  page,
}) => {
  const boss = await owner();
  const tag = randomUUID().slice(0, 6);
  const book = await (
    await boss.post(`${API_URL}/api/books`, {
      headers,
      data: {
        title: `Laskar Pelangi ${tag}`,
        author: "Andrea Hirata",
        genre: "Sastra Indonesia",
        year: 2005,
        description: "Sepuluh anak Belitong dan sekolah mereka.",
        coverUrl: "/covers/laskar-pelangi.jpg",
      },
    })
  ).json();
  const table = await (
    await boss.post(`${API_URL}/api/tables`, {
      headers,
      data: { tableNumber: tag.slice(0, 4).toUpperCase(), area: "Teras" },
    })
  ).json();

  // A customer borrows it from the table's QR app (no account).
  const loan = await page.request.post(`${API_URL}/api/public/book-loans`, {
    data: {
      qrCode: table.data.qrCode,
      bookId: book.data.id,
      borrowerName: "Rina",
    },
  });
  expect(loan.status()).toBe(201);

  const signIn = await authPost(page.request, "/api/auth/sign-in/email", {
    email: OWNER_EMAIL,
    password: PASSWORD,
  });
  expect(signIn.ok()).toBe(true);

  await page.goto("/menu-meja");
  await page.getByRole("tab", { name: /Buku/ }).click();
  const card = page.locator(`.mm-card[data-id="${book.data.id}"]`);
  await expect(card).toContainText(`Meja ${table.data.tableNumber} · Rina`);
  await expect(card.getByText("Dipinjam", { exact: true })).toBeVisible();
  // The bundled cover loads.
  await expect
    .poll(() =>
      card
        .locator("img.mm-cover")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: test.info().outputPath("buku-tab.png"),
    fullPage: true,
  });

  await card.getByRole("button", { name: "Sudah kembali" }).click();
  await expect(card).not.toContainText("Rina");
  await expect(card.getByRole("switch")).toBeChecked();

  // Add a book through the dialog.
  await page.locator('[data-tab-action="buku"]').click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Judul buku", { exact: true })
    .fill(`Bumi Manusia ${tag}`);
  await dialog.getByLabel(/Penulis/).fill("Pramoedya Ananta Toer");
  await dialog.getByLabel(/Tahun terbit/).fill("1980");
  await dialog
    .getByLabel(/Alamat gambar cover/)
    .fill("/covers/bumi-manusia.jpg");
  await expect(dialog.locator(".mm-bk-prev img")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("buku-dialog.png") });
  await dialog.getByRole("button", { name: "Simpan buku" }).click();
  const added = page.locator(".mm-card", { hasText: `Bumi Manusia ${tag}` });
  await expect(added).toContainText("Pramoedya Ananta Toer · 1980");

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await fitsWidth(page)).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("buku-mobile.png"),
    fullPage: true,
  });
});
