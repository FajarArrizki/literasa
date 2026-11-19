import { Router } from "express";
import { recordIdSchema } from "@starter/shared/validators/fnb/common";
import {
  createBookSchema,
  updateBookSchema,
} from "@starter/shared/validators/fnb/books";
import { requireAuth } from "../middleware/auth";
import { jsonBody } from "../middleware/body";
import { requireTrustedOrigin } from "../middleware/origin";
import { requireStaff } from "../middleware/staff";
import {
  createBook,
  deleteBook,
  listBooks,
  returnBook,
  updateBook,
} from "../services/books.service";

// The reading shelf. Every staff member sees it and can take a returned book
// back; changing the shelf needs the same "menu" permission as the menu.
const read = requireStaff();
const manage = requireStaff("menu");

export const booksRouter = Router();
booksRouter.use(requireAuth, requireTrustedOrigin);

booksRouter.get("/", read, async (_req, res) => {
  res.json({ data: await listBooks() });
});

booksRouter.post("/", manage, jsonBody, async (req, res) => {
  const book = await createBook(createBookSchema.parse(req.body));
  res.status(201).location(`/api/books/${book.id}`).json({ data: book });
});

booksRouter.patch("/:id", manage, jsonBody, async (req, res) => {
  const id = recordIdSchema.parse(req.params.id);
  const input = updateBookSchema.parse(req.body);
  res.json({ data: await updateBook(id, input) });
});

booksRouter.delete("/:id", manage, async (req, res) => {
  await deleteBook(recordIdSchema.parse(req.params.id));
  res.status(204).end();
});

booksRouter.post("/:id/return", read, async (req, res) => {
  const id = recordIdSchema.parse(req.params.id);
  res.json({ data: await returnBook(id) });
});
