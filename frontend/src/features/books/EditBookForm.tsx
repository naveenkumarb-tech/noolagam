import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Book, BookChanges } from "../../api/books";
import { apiErrorMessage } from "../../api/errors";
import { BackButton } from "../../components/BackButton";
import { Button } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { TextAreaField } from "../../components/TextAreaField";
import { TextField } from "../../components/TextField";
import { bookFields } from "./addBookSchema";
import { normalizeIsbn } from "./isbn";
import { localDate } from "./localDate";
import { useUpdateBook } from "./useBooks";
import { useGoBack } from "./useGoBack";

function editBookSchema(book: Book) {
  return z
    .object({
      ...bookFields,
      description: z.string().trim().max(20_000, "Use at most 20,000 characters"),
      startedAt: z.string(),
      finishedAt: z.string(),
    })
    .superRefine(({ startedAt, finishedAt }, context) => {
      const today = localDate();
      const checkDate = (name: "startedAt" | "finishedAt", value: string) => {
        if (!value) context.addIssue({ code: "custom", path: [name], message: "Choose a date" });
        else if (value > today) context.addIssue({ code: "custom", path: [name], message: "This date is in the future" });
      };
      if (book.status !== "to_read") checkDate("startedAt", startedAt);
      if (book.status === "finished") {
        checkDate("finishedAt", finishedAt);
        if (startedAt && finishedAt && startedAt > finishedAt) {
          context.addIssue({
            code: "custom",
            path: ["finishedAt"],
            message: "This is before the date you started",
          });
        }
      }
    });
}

type EditBookValues = z.infer<ReturnType<typeof editBookSchema>>;

function toChanges(values: EditBookValues, book: Book): BookChanges {
  return {
    title: values.title,
    author: values.author,
    isbn: values.isbn ? normalizeIsbn(values.isbn) : null,
    page_count: values.pageCount ? Number(values.pageCount) : null,
    gifted_by: values.giftedBy || null,
    description: values.description || null,
    started_at: book.status !== "to_read" ? values.startedAt : undefined,
    finished_at: book.status === "finished" ? values.finishedAt : undefined,
  };
}

export function EditBookForm({ book }: { book: Book }) {
  const update = useUpdateBook(book.id);
  const goBack = useGoBack(`/books/${book.id}`);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditBookValues>({
    resolver: zodResolver(editBookSchema(book)),
    defaultValues: {
      title: book.title,
      author: book.author,
      isbn: book.isbn ?? "",
      pageCount: book.page_count === null ? "" : String(book.page_count),
      giftedBy: book.gifted_by ?? "",
      description: book.description ?? "",
      startedAt: book.started_at ?? "",
      finishedAt: book.finished_at ?? "",
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      <div className="flex items-center gap-3">
        <BackButton label="Back to book" onClick={goBack} />
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.3px]">Edit book</h1>
      </div>

      <form
        noValidate
        className="flex flex-col gap-3.5"
        onSubmit={handleSubmit((values) => update.mutate(toChanges(values, book), { onSuccess: goBack }))}
      >
        <TextField label="Title" type="text" error={errors.title?.message} {...register("title")} />
        <TextField label="Author" type="text" error={errors.author?.message} {...register("author")} />
        <div className="grid grid-cols-2 gap-2.5">
          <TextField
            label="Pages"
            type="text"
            inputMode="numeric"
            error={errors.pageCount?.message}
            {...register("pageCount")}
          />
          <TextField
            label="Gifted by"
            type="text"
            placeholder="Optional"
            error={errors.giftedBy?.message}
            {...register("giftedBy")}
          />
        </div>
        <TextField
          label="ISBN"
          type="text"
          autoComplete="off"
          placeholder="Optional"
          error={errors.isbn?.message}
          {...register("isbn")}
        />
        {book.status !== "to_read" && (
          <TextField
            label="Started on"
            type="date"
            max={localDate()}
            error={errors.startedAt?.message}
            {...register("startedAt")}
          />
        )}
        {book.status === "finished" && (
          <TextField
            label="Finished on"
            type="date"
            max={localDate()}
            error={errors.finishedAt?.message}
            {...register("finishedAt")}
          />
        )}
        <TextAreaField
          label="Description"
          rows={5}
          placeholder="Optional"
          error={errors.description?.message}
          {...register("description")}
        />

        {update.isError && <FormError message={apiErrorMessage(update.error)} />}
        <Button type="submit" isLoading={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
