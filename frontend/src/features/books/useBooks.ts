import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBook,
  deleteBook,
  finishReading,
  getBook,
  getBookCounts,
  getBookFacets,
  getCurrentlyReading,
  listBooks,
  resetBook,
  searchBooks,
  startReading,
  updateBook,
  updateProgress,
  uploadCover,
  type Book,
  type BookChanges,
  type BookListParams,
  type NewBook,
} from "../../api/books";
import { localDate } from "./localDate";

export const BOOKS_KEY = "books";
const PAGE_SIZE = 20;

export type BookListFilters = Omit<BookListParams, "page" | "per_page"> & { q?: string };

export function useCurrentlyReading() {
  return useQuery({ queryKey: [BOOKS_KEY, "current"], queryFn: getCurrentlyReading });
}

export function useBookCounts() {
  return useQuery({ queryKey: [BOOKS_KEY, "counts"], queryFn: getBookCounts });
}

export function useUpNext() {
  return useQuery({
    queryKey: [BOOKS_KEY, "up-next"],
    queryFn: () => listBooks({ status: "to_read", per_page: 3 }),
  });
}

export function useRecentlyAdded() {
  return useQuery({ queryKey: [BOOKS_KEY, "recent"], queryFn: () => listBooks({ per_page: 5 }) });
}

export function useBookList({ q, sort, ...filters }: BookListFilters) {
  return useInfiniteQuery({
    queryKey: [BOOKS_KEY, "list", q, filters, q ? undefined : sort],
    queryFn: ({ pageParam }) => {
      const paging = { page: pageParam, per_page: PAGE_SIZE };
      // Search results are ordered by relevance, so the chosen sort does not apply.
      return q ? searchBooks(q, { ...filters, ...paging }) : listBooks({ ...filters, sort, ...paging });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.per_page < lastPage.total ? lastPage.page + 1 : undefined,
    // Keeps the current list on screen while the next search loads.
    placeholderData: keepPreviousData,
  });
}

export function useBookFacets() {
  return useQuery({ queryKey: [BOOKS_KEY, "facets"], queryFn: getBookFacets });
}

export function useBook(bookId: number) {
  return useQuery({ queryKey: [BOOKS_KEY, "detail", bookId], queryFn: () => getBook(bookId) });
}

function useInvalidateBooks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [BOOKS_KEY] });
}

export type SavedBook = {
  book: Book;
  /** The book is saved either way, so a failed photo isn't a failed save: trying again would add it twice. */
  photoError: unknown;
};

async function createBookWithPhoto({ book, photo }: { book: NewBook; photo: File | null }): Promise<SavedBook> {
  const saved = await createBook(book);
  if (!photo) {
    return { book: saved, photoError: null };
  }
  try {
    return { book: await uploadCover(saved.id, photo), photoError: null };
  } catch (photoError) {
    return { book: saved, photoError };
  }
}

export function useCreateBook() {
  const invalidateBooks = useInvalidateBooks();
  return useMutation({ mutationFn: createBookWithPhoto, onSuccess: invalidateBooks });
}

export function useUploadCover(bookId: number) {
  const invalidateBooks = useInvalidateBooks();
  return useMutation({ mutationFn: (photo: File) => uploadCover(bookId, photo), onSuccess: invalidateBooks });
}

export function useStartReading() {
  const invalidateBooks = useInvalidateBooks();
  return useMutation({
    mutationFn: (bookId: number) => startReading(bookId, localDate()),
    onSuccess: invalidateBooks,
  });
}

export function useUpdateProgress() {
  const invalidateBooks = useInvalidateBooks();
  return useMutation({
    mutationFn: ({ bookId, currentPage }: { bookId: number; currentPage: number }) =>
      updateProgress(bookId, currentPage),
    onSuccess: invalidateBooks,
  });
}

export function useFinishReading() {
  const invalidateBooks = useInvalidateBooks();
  return useMutation({
    mutationFn: ({ bookId, rating }: { bookId: number; rating: number | null }) =>
      finishReading(bookId, localDate(), rating),
    onSuccess: invalidateBooks,
  });
}

export function useUpdateBook(bookId: number) {
  const invalidateBooks = useInvalidateBooks();
  return useMutation({
    mutationFn: (changes: BookChanges) => updateBook(bookId, changes),
    onSuccess: invalidateBooks,
  });
}

export function useResetBook(bookId: number) {
  const invalidateBooks = useInvalidateBooks();
  return useMutation({ mutationFn: () => resetBook(bookId), onSuccess: invalidateBooks });
}

export function useDeleteBook(bookId: number) {
  const queryClient = useQueryClient();
  const invalidateBooks = useInvalidateBooks();
  return useMutation({
    mutationFn: () => deleteBook(bookId),
    onSuccess: () => {
      // Removed first, or the refresh below would ask for the deleted book and get a 404.
      queryClient.removeQueries({ queryKey: [BOOKS_KEY, "detail", bookId] });
      return invalidateBooks();
    },
  });
}
