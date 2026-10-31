import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { Book } from "../../api/books";
import { apiErrorMessage } from "../../api/errors";
import { Button } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { ProgressBar } from "../../components/ProgressBar";
import { TextField } from "../../components/TextField";
import { pageSchema } from "./pageSchema";
import { readingTimeLabel } from "./readingTime";
import { useUpdateProgress } from "./useBooks";

export function ProgressCard({ book }: { book: Book }) {
  const update = useUpdateProgress();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(pageSchema(book.page_count)),
    defaultValues: { currentPage: book.current_page },
  });

  const readingTime = readingTimeLabel(book);
  const label = book.page_count === null ? "Current page" : `Current page (of ${book.page_count})`;

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-base font-bold">Progress</h2>
        {book.progress_percent !== null && (
          <span className="text-sm font-bold text-primary">{book.progress_percent}%</span>
        )}
      </div>
      {book.progress_percent !== null && (
        <ProgressBar percent={book.progress_percent} label={`Progress in ${book.title}`} />
      )}
      {readingTime && <p className="m-0 text-sm text-text-secondary">{readingTime}</p>}
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={handleSubmit(({ currentPage }) => update.mutate({ bookId: book.id, currentPage }))}
      >
        {update.isError && <FormError message={apiErrorMessage(update.error)} />}
        <TextField
          label={label}
          type="number"
          inputMode="numeric"
          min={0}
          error={errors.currentPage?.message}
          trailing={
            <Button type="submit" variant="outline" size="md" className="!h-12 !w-auto flex-none px-[18px]" isLoading={update.isPending}>
              Update
            </Button>
          }
          {...register("currentPage", { valueAsNumber: true })}
        />
      </form>
    </section>
  );
}
