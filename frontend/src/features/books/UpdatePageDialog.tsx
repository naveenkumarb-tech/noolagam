import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { Book } from "../../api/books";
import { apiErrorMessage } from "../../api/errors";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { FormError } from "../../components/FormError";
import { TextField } from "../../components/TextField";
import { pageSchema } from "./pageSchema";
import { useUpdateProgress } from "./useBooks";

type UpdatePageDialogProps = {
  book: Book;
  onClose: () => void;
};

export function UpdatePageDialog({ book, onClose }: UpdatePageDialogProps) {
  const update = useUpdateProgress();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(pageSchema(book.page_count)),
    defaultValues: { currentPage: book.current_page },
  });

  const label = book.page_count === null ? "Current page" : `Current page (of ${book.page_count})`;

  return (
    <Dialog title={book.title} onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(({ currentPage }) =>
          update.mutate({ bookId: book.id, currentPage }, { onSuccess: onClose }),
        )}
      >
        {update.isError && <FormError message={apiErrorMessage(update.error)} />}
        <TextField
          label={label}
          type="number"
          inputMode="numeric"
          min={0}
          autoFocus
          error={errors.currentPage?.message}
          {...register("currentPage", { valueAsNumber: true })}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="md" isLoading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
