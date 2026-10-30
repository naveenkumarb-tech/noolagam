import { useState } from "react";

import type { Book } from "../../api/books";
import { apiErrorMessage } from "../../api/errors";
import { TextAreaField } from "../../components/TextAreaField";
import { useUpdateBook } from "./useBooks";

export function NotesEditor({ book }: { book: Book }) {
  const [text, setText] = useState(book.notes ?? "");
  const update = useUpdateBook(book.id);

  // Saved when the field loses focus. Tapping Back does that first, so nothing typed is lost.
  const saveIfChanged = () => {
    if (text !== (book.notes ?? "")) {
      update.mutate({ notes: text || null });
    }
  };

  return (
    <section className="flex flex-col gap-1.5">
      <TextAreaField
        label="My notes"
        rows={3}
        maxLength={20_000}
        value={text}
        placeholder="Thoughts, favourite lines, characters…"
        onChange={(event) => {
          setText(event.target.value);
          update.reset();
        }}
        onBlur={saveIfChanged}
      />
      <p role="status" className="m-0 text-[13px] text-text-secondary empty:hidden">
        {update.isPending && "Saving…"}
        {update.isSuccess && "Saved"}
      </p>
      {update.isError && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
          Your notes were not saved. {apiErrorMessage(update.error)}
        </p>
      )}
    </section>
  );
}
