import { z } from "zod";

import { isValidIsbn } from "./isbn";
import { localDate } from "./localDate";

const MAX_PAGES = 100_000;

export const bookFields = {
  isbn: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidIsbn(value), "Enter a valid 10 or 13 digit ISBN"),
  title: z.string().trim().min(1, "Enter the title").max(255, "Use at most 255 characters"),
  author: z.string().trim().min(1, "Enter the author").max(255, "Use at most 255 characters"),
  pageCount: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= MAX_PAGES),
      "Enter a number from 1 to 100,000",
    ),
  giftedBy: z.string().trim().max(255, "Use at most 255 characters"),
};

export const addBookSchema = z
  .object({
    ...bookFields,
    status: z.enum(["to_read", "reading", "finished"]),
    date: z.string(),
    rating: z.number().nullable(),
  })
  .superRefine(({ status, date }, context) => {
    if (status === "to_read") return;
    if (!date) {
      context.addIssue({ code: "custom", path: ["date"], message: "Choose a date" });
    } else if (date > localDate()) {
      context.addIssue({ code: "custom", path: ["date"], message: "This date is in the future" });
    }
  });

export type AddBookFormValues = z.infer<typeof addBookSchema>;
