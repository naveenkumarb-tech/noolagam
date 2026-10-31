import { Link } from "react-router";

import type { Book } from "../../api/books";
import { Cover } from "../../components/Cover";
import { StatusChip } from "../../components/StatusChip";
import { readingDays, readingTimeLabel } from "./readingTime";

export function BookRow({ book }: { book: Book }) {
  return (
    <li className="min-w-0">
      <Link
        to={`/books/${book.id}`}
        className="flex h-full items-center gap-3.5 rounded-[14px] bg-surface p-3 text-text no-underline shadow-card hover:text-text hover:shadow-md"
      >
        <Cover title={book.title} coverUrl={book.cover_url} showTitle={false} sizeClass="h-[72px] w-12" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[15px] font-bold">{book.title}</span>
          <span className="truncate text-[13px] text-text-secondary">{book.author}</span>
          <span className="flex flex-wrap gap-1.5">
            <StatusChip book={book} />
            {/* Left out at 0 days, where there's no real length to show on a short row. */}
            {Boolean(readingDays(book)) && (
              <span className="rounded-full bg-to-read-bg px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-to-read">
                {readingTimeLabel(book)}
              </span>
            )}
            {book.gifted_by && (
              <span className="max-w-full truncate rounded-full bg-gifted-bg px-2.5 py-0.5 text-xs font-semibold text-gifted">
                Gift · {book.gifted_by}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
