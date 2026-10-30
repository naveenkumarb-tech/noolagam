import { isAxiosError } from "axios";
import { Link, useParams } from "react-router";

import { SectionError, SectionSkeleton } from "../components/SectionStates";
import { BookDetails } from "../features/books/BookDetails";
import { useBook } from "../features/books/useBooks";

export function BookNotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="m-0 text-[22px] font-extrabold">Book not found</h1>
      <p className="m-0 text-[15px] text-text-secondary">It may have been deleted.</p>
      <Link to="/books" className="inline-flex min-h-11 items-center text-[15px] font-bold no-underline">
        Back to My books
      </Link>
    </div>
  );
}

export function isNotFound(error: unknown): boolean {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  // A web address like /books/abc is a 422, and to the reader it is the same thing.
  return status === 404 || status === 422;
}

export function BookDetailPage() {
  const { bookId } = useParams();
  const { data: book, isPending, isError, error, refetch } = useBook(Number(bookId));

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
        <SectionSkeleton heightClass="h-44" />
        <SectionSkeleton heightClass="h-64" />
      </div>
    );
  }
  if (isError) {
    return isNotFound(error) ? <BookNotFound /> : <SectionError error={error} onRetry={refetch} />;
  }
  return <BookDetails book={book} />;
}
