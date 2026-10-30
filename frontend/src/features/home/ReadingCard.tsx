import { useState } from "react";
import { Link } from "react-router";

import type { Book } from "../../api/books";
import { Button } from "../../components/Button";
import { Cover } from "../../components/Cover";
import { ProgressBar } from "../../components/ProgressBar";
import { FinishBookDialog } from "../books/FinishBookDialog";
import { UpdatePageDialog } from "../books/UpdatePageDialog";

type ReadingCardProps = {
  book: Book;
  /** The first book gets a large card on phones. On laptops every card is large. */
  isFeatured: boolean;
};

export function ReadingCard({ book, isFeatured }: ReadingCardProps) {
  const [openDialog, setOpenDialog] = useState<"page" | "finish" | null>(null);
  const closeDialog = () => setOpenDialog(null);

  const pageLabel = book.page_count === null ? `Page ${book.current_page}` : `Page ${book.current_page} of ${book.page_count}`;

  return (
    <article className="flex min-w-0 flex-col gap-3.5 rounded-2xl bg-surface p-4 shadow-card lg:p-[18px]">
      <div className="flex gap-3.5">
        <Cover
          title={book.title}
          coverUrl={book.cover_url}
          showTitle={isFeatured}
          sizeClass={isFeatured ? "h-[108px] w-[72px] lg:h-[120px] lg:w-20" : "h-[66px] w-11 lg:h-[120px] lg:w-20"}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Link
            to={`/books/${book.id}`}
            className="text-base leading-[1.3] font-bold text-text no-underline hover:text-primary lg:text-[17px]"
          >
            {book.title}
          </Link>
          <span className="text-sm text-text-secondary">{book.author}</span>
          {book.gifted_by && (
            <span
              className={`self-start rounded-full bg-gifted-bg px-2.5 py-[3px] text-xs font-semibold text-gifted ${
                isFeatured ? "" : "hidden lg:inline"
              }`}
            >
              Gifted by {book.gifted_by}
            </span>
          )}
          <div className="mt-auto flex flex-col gap-1.5 pt-1">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>{pageLabel}</span>
              {book.progress_percent !== null && (
                <span className="font-bold text-primary">{book.progress_percent}%</span>
              )}
            </div>
            {book.progress_percent !== null && (
              <ProgressBar percent={book.progress_percent} label={`Progress in ${book.title}`} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="outline" size="md" aria-label={`Update page for ${book.title}`} onClick={() => setOpenDialog("page")}>
          Update page
        </Button>
        <Button size="md" aria-label={`Mark ${book.title} as finished`} onClick={() => setOpenDialog("finish")}>
          Mark finished
        </Button>
      </div>

      {openDialog === "page" && <UpdatePageDialog book={book} onClose={closeDialog} />}
      {openDialog === "finish" && <FinishBookDialog book={book} onClose={closeDialog} />}
    </article>
  );
}
