import { Link } from "react-router";

import type { Book } from "../../api/books";
import { Cover } from "../../components/Cover";
import { StatusChip } from "../../components/StatusChip";

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
