import { useParams } from "react-router";

import { SectionError, SectionSkeleton } from "../components/SectionStates";
import { EditBookForm } from "../features/books/EditBookForm";
import { useBook } from "../features/books/useBooks";
import { BookNotFound, isNotFound } from "./BookDetailPage";

export function EditBookPage() {
  const { bookId } = useParams();
  const { data: book, isPending, isError, error, refetch } = useBook(Number(bookId));

  if (isPending) {
    return <SectionSkeleton heightClass="h-96" />;
  }
  if (isError) {
    return isNotFound(error) ? <BookNotFound /> : <SectionError error={error} onRetry={refetch} />;
  }
  return <EditBookForm book={book} />;
}
