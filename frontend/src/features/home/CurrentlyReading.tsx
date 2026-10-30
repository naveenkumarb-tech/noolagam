import { Link } from "react-router";

import { SectionError, SectionSkeleton } from "../../components/SectionStates";
import { useCurrentlyReading } from "../books/useBooks";
import { ReadingCard } from "./ReadingCard";

function EmptyNightstand() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface p-6 text-center shadow-card">
      <p className="m-0 text-base font-bold">Nothing on your nightstand</p>
      <p className="m-0 text-sm text-text-secondary">Add a book to start tracking what you read.</p>
      <Link
        to="/books/new"
        className="flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white no-underline hover:bg-primary-hover hover:text-white"
      >
        Add a book
      </Link>
    </div>
  );
}

export function CurrentlyReading() {
  const { data: books, isPending, isError, error, refetch } = useCurrentlyReading();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-[17px] font-bold lg:text-[19px]">Currently reading</h2>
        {books && books.length > 0 && (
          <span className="text-[13px] text-text-secondary">
            {books.length} {books.length === 1 ? "book" : "books"}
          </span>
        )}
      </div>

      {isPending && <SectionSkeleton heightClass="h-52" />}
      {isError && <SectionError error={error} onRetry={refetch} />}
      {books?.length === 0 && <EmptyNightstand />}
      {books && books.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-3.5">
          {books.map((book, index) => (
            <ReadingCard key={book.id} book={book} isFeatured={index === 0} />
          ))}
        </div>
      )}
    </section>
  );
}
