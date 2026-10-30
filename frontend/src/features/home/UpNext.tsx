import { Link } from "react-router";

import type { Book } from "../../api/books";
import { apiErrorMessage } from "../../api/errors";
import { Button } from "../../components/Button";
import { Cover } from "../../components/Cover";
import { SectionError, SectionSkeleton } from "../../components/SectionStates";
import { useStartReading, useUpNext } from "../books/useBooks";

function UpNextRow({ book }: { book: Book }) {
  const start = useStartReading();

  return (
    <li className="flex flex-col gap-2 rounded-[14px] bg-surface p-3 shadow-card">
      <div className="flex items-center gap-3">
        <Cover title={book.title} coverUrl={book.cover_url} showTitle={false} sizeClass="h-[60px] w-10" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            to={`/books/${book.id}`}
            className="truncate text-[15px] font-bold text-text no-underline hover:text-primary"
          >
            {book.title}
          </Link>
          <span className="truncate text-[13px] text-text-secondary">{book.author}</span>
        </div>
        <Button
          variant="outline"
          size="md"
          className="!w-auto flex-none px-4"
          aria-label={`Start reading ${book.title}`}
          isLoading={start.isPending}
          onClick={() => start.mutate(book.id)}
        >
          Start
        </Button>
      </div>
      {start.isError && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
          {apiErrorMessage(start.error)}
        </p>
      )}
    </li>
  );
}

export function UpNext() {
  const { data, isPending, isError, error, refetch } = useUpNext();

  if (data?.items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-[17px] font-bold lg:text-[19px]">Up next</h2>
      {isPending && <SectionSkeleton heightClass="h-20" />}
      {isError && <SectionError error={error} onRetry={refetch} />}
      {data && (
        <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 lg:grid-cols-3 lg:gap-3.5">
          {data.items.map((book) => (
            <UpNextRow key={book.id} book={book} />
          ))}
        </ul>
      )}
    </section>
  );
}
