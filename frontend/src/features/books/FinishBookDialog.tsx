import { useState } from "react";

import type { Book } from "../../api/books";
import { apiErrorMessage } from "../../api/errors";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { FormError } from "../../components/FormError";
import { RatingPicker } from "./RatingPicker";
import { useFinishReading } from "./useBooks";

type FinishBookDialogProps = {
  book: Book;
  onClose: () => void;
};

export function FinishBookDialog({ book, onClose }: FinishBookDialogProps) {
  const finish = useFinishReading();
  const [rating, setRating] = useState<number | null>(null);

  return (
    <Dialog title={`Finished ${book.title}?`} onClose={onClose}>
      {finish.isError && <FormError message={apiErrorMessage(finish.error)} />}
      <RatingPicker value={rating} onChange={setRating} />
      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" variant="outline" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="md"
          isLoading={finish.isPending}
          onClick={() => finish.mutate({ bookId: book.id, rating }, { onSuccess: onClose })}
        >
          Mark finished
        </Button>
      </div>
    </Dialog>
  );
}
