CREATE TABLE "book_loans" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"table_id" text,
	"table_number" text NOT NULL,
	"borrower_name" text DEFAULT '' NOT NULL,
	"borrowed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"returned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"genre" text NOT NULL,
	"year" integer,
	"description" text DEFAULT '' NOT NULL,
	"cover_url" text DEFAULT '' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_table_id_cafe_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."cafe_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_loans_open_uq" ON "book_loans" USING btree ("book_id") WHERE "book_loans"."returned_at" IS NULL;--> statement-breakpoint
CREATE INDEX "book_loans_table_idx" ON "book_loans" USING btree ("table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "books_title_author_uq" ON "books" USING btree (lower("title"),lower("author"));