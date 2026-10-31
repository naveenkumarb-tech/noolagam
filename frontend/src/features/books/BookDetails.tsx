import { useState } from "react";
import { Link, useNavigate } from "react-router";

import type { Book } from "../../api/books";
import { apiErrorMessage } from "../../api/errors";
import { BackButton } from "../../components/BackButton";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Cover } from "../../components/Cover";
import { StatusChip } from "../../components/StatusChip";
import { FinishBookDialog } from "./FinishBookDialog";
import { formatBookDate } from "./formatDate";
import { NotesEditor } from "./NotesEditor";
import { ProgressCard } from "./ProgressCard";
import { RatingPicker } from "./RatingPicker";
import { readingTimeLabel } from "./readingTime";
import { useDeleteBook, useFinishReading, useResetBook, useStartReading } from "./useBooks";
import { useGoBack } from "./useGoBack";

function InfoTile({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface px-3 py-2.5 shadow-card">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className={`m-0 mt-0.5 truncate text-[15px] font-bold ${valueClass}`}>{value}</dd>
    </div>
  );
}

function FinishedCard({ book }: { book: Book }) {
  const finish = useFinishReading();
  const readingTime = readingTimeLabel(book);

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card">
      <div className="flex flex-col gap-0.5">
        <p className="m-0 text-[15px] font-bold">
          Finished on {book.finished_at ? formatBookDate(book.finished_at) : "—"}
        </p>
        {readingTime && <p className="m-0 text-sm text-text-secondary">{readingTime}</p>}
      </div>
      <RatingPicker
        value={book.rating}
        onChange={(rating) => finish.mutate({ bookId: book.id, rating })}
      />
      {finish.isError && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
          {apiErrorMessage(finish.error)}
        </p>
      )}
    </section>
  );
}

function AboutBook({ book }: { book: Book }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!book.description && !book.isbn) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card">
      <h2 className="m-0 text-base font-bold">About this book</h2>
      {book.description && (
        <>
          <p
            className={`m-0 text-sm leading-relaxed whitespace-pre-line text-text-secondary ${
              isExpanded ? "" : "line-clamp-4"
            }`}
          >
            {book.description}
          </p>
          {book.description.length > 200 && (
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded(!isExpanded)}
              className="min-h-11 cursor-pointer self-start border-0 bg-transparent p-0 text-sm font-bold text-primary"
            >
              {isExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </>
      )}
      {book.isbn && <p className="m-0 text-[13px] text-text-secondary">ISBN {book.isbn}</p>}
    </section>
  );
}

function BookActions({ book }: { book: Book }) {
  const navigate = useNavigate();
  const start = useStartReading();
  const reset = useResetBook(book.id);
  const remove = useDeleteBook(book.id);
  const [openDialog, setOpenDialog] = useState<"finish" | "reset" | "delete" | null>(null);
  const closeDialog = () => {
    setOpenDialog(null);
    reset.reset();
    remove.reset();
  };

  return (
    <div className="flex flex-col gap-2">
      {book.status === "to_read" && (
        <Button isLoading={start.isPending} onClick={() => start.mutate(book.id)}>
          Start reading
        </Button>
      )}
      {book.status === "reading" && <Button onClick={() => setOpenDialog("finish")}>Mark as finished</Button>}
      {start.isError && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
          {apiErrorMessage(start.error)}
        </p>
      )}

      <div className="flex justify-between">
        {book.status !== "to_read" ? (
          <button
            type="button"
            onClick={() => setOpenDialog("reset")}
            className="h-11 cursor-pointer border-0 bg-transparent px-1 text-sm font-semibold text-text-tertiary"
          >
            Move back to To-read
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setOpenDialog("delete")}
          className="h-11 cursor-pointer border-0 bg-transparent px-1 text-sm font-bold text-danger"
        >
          Delete
        </button>
      </div>

      {openDialog === "finish" && <FinishBookDialog book={book} onClose={closeDialog} />}
      {openDialog === "reset" && (
        <ConfirmDialog
          title="Move back to To-read?"
          message="This clears your reading dates, progress and rating. Your notes stay."
          confirmLabel="Move back"
          isPending={reset.isPending}
          error={reset.error}
          onConfirm={() => reset.mutate(undefined, { onSuccess: closeDialog })}
          onClose={closeDialog}
        />
      )}
      {openDialog === "delete" && (
        <ConfirmDialog
          title={`Delete ${book.title}?`}
          message="This removes the book and your notes. It can't be undone."
          confirmLabel="Delete"
          isPending={remove.isPending}
          error={remove.error}
          onConfirm={() =>
            remove.mutate(undefined, { onSuccess: () => navigate("/books", { replace: true }) })
          }
          onClose={closeDialog}
        />
      )}
    </div>
  );
}

export function BookDetails({ book }: { book: Book }) {
  const goBack = useGoBack("/books");

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <BackButton label="Back to books" onClick={goBack} />
        <Link
          to={`/books/${book.id}/edit`}
          className="flex h-11 items-center rounded-full border border-input-border bg-surface px-[18px] text-sm font-bold text-text no-underline hover:bg-background hover:text-text"
        >
          Edit
        </Link>
      </div>

      <div className="flex items-end gap-4">
        <Cover
          title={book.title}
          coverUrl={book.cover_url}
          sizeClass="h-[156px] w-[104px] shadow-[0_6px_16px_rgba(17,24,39,0.2)]"
        />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <StatusChip book={book} />
          <h1 className="m-0 text-[22px] leading-[1.2] font-extrabold tracking-[-0.3px] wrap-anywhere">{book.title}</h1>
          <span className="text-[15px] text-text-secondary">{book.author}</span>
        </div>
      </div>

      <dl className="m-0 grid grid-cols-3 gap-2">
        <InfoTile label="Gifted by" value={book.gifted_by ?? "—"} valueClass={book.gifted_by ? "text-gifted" : ""} />
        <InfoTile label="Started" value={book.started_at ? formatBookDate(book.started_at) : "—"} />
        <InfoTile label="Pages" value={book.page_count === null ? "—" : String(book.page_count)} />
      </dl>

      {/* Keyed by the page, so the input shows the saved value after a change elsewhere. */}
      {book.status === "reading" && <ProgressCard key={book.current_page} book={book} />}
      {book.status === "finished" && <FinishedCard book={book} />}

      <AboutBook book={book} />
      <NotesEditor book={book} />
      <BookActions book={book} />
    </div>
  );
}
