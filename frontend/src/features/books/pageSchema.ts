import { z } from "zod";

export function pageSchema(pageCount: number | null) {
  const page = z
    .number({ error: "Enter a page number" })
    .int("Enter a whole number")
    .min(0, "The page can't be negative");
  return z.object({
    currentPage: pageCount === null ? page : page.max(pageCount, `This book has ${pageCount} pages`),
  });
}
