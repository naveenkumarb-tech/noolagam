import { apiClient } from "./client";

export type BookStatus = "to_read" | "reading" | "finished";

export type Book = {
  id: number;
  title: string;
  author: string;
  isbn: string | null;
  cover_url: string | null;
  description: string | null;
  page_count: number | null;
  current_page: number;
  gifted_by: string | null;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  progress_percent: number | null;
};

export type BookCounts = {
  total: number;
  to_read: number;
  reading: number;
  finished: number;
  gifted: number;
};

export type BookPage = {
  items: Book[];
  total: number;
  page: number;
  per_page: number;
};

export type BookLookup = {
  isbn: string;
  title: string | null;
  author: string | null;
  page_count: number | null;
  cover_url: string | null;
  description: string | null;
};

export type NewBook = {
  title: string;
  author: string;
  isbn?: string;
  page_count?: number;
  gifted_by?: string;
  cover_url?: string;
  description?: string;
  status: BookStatus;
  started_at?: string;
  finished_at?: string;
  rating?: number;
};

export async function lookupBook(isbn: string): Promise<BookLookup> {
  const { data } = await apiClient.get<BookLookup>("/books/lookup", { params: { isbn } });
  return data;
}

export async function createBook(book: NewBook): Promise<Book> {
  const { data } = await apiClient.post<Book>("/books", book);
  return data;
}

export async function getCurrentlyReading(): Promise<Book[]> {
  const { data } = await apiClient.get<Book[]>("/books/current");
  return data;
}

export async function getBookCounts(): Promise<BookCounts> {
  const { data } = await apiClient.get<BookCounts>("/books/counts");
  return data;
}

export type BookSort = "recent" | "title" | "author" | "finished";

export type BookFacets = {
  authors: string[];
  gifted_by: string[];
};

export type BookListParams = {
  status?: BookStatus;
  author?: string;
  gifted_by?: string;
  sort?: BookSort;
  page?: number;
  per_page?: number;
};

export type BookChanges = {
  title?: string;
  author?: string;
  isbn?: string | null;
  page_count?: number | null;
  gifted_by?: string | null;
  description?: string | null;
  notes?: string | null;
  started_at?: string;
  finished_at?: string;
};

export async function listBooks(params: BookListParams): Promise<BookPage> {
  const { data } = await apiClient.get<BookPage>("/books", { params });
  return data;
}

export async function searchBooks(q: string, params: Omit<BookListParams, "sort">): Promise<BookPage> {
  const { data } = await apiClient.get<BookPage>("/search", { params: { q, ...params } });
  return data;
}

export async function getBookFacets(): Promise<BookFacets> {
  const { data } = await apiClient.get<BookFacets>("/books/facets");
  return data;
}

export async function getBook(bookId: number): Promise<Book> {
  const { data } = await apiClient.get<Book>(`/books/${bookId}`);
  return data;
}

export async function updateBook(bookId: number, changes: BookChanges): Promise<Book> {
  const { data } = await apiClient.patch<Book>(`/books/${bookId}`, changes);
  return data;
}

export async function uploadCover(bookId: number, photo: File): Promise<Book> {
  const form = new FormData();
  form.append("photo", photo);
  const { data } = await apiClient.post<Book>(`/books/${bookId}/cover`, form);
  return data;
}

export async function deleteBook(bookId: number): Promise<void> {
  await apiClient.delete(`/books/${bookId}`);
}

export async function resetBook(bookId: number): Promise<Book> {
  const { data } = await apiClient.post<Book>(`/books/${bookId}/reset`);
  return data;
}

export async function startReading(bookId: number, startedAt: string): Promise<Book> {
  const { data } = await apiClient.post<Book>(`/books/${bookId}/start`, { started_at: startedAt });
  return data;
}

export async function updateProgress(bookId: number, currentPage: number): Promise<Book> {
  const { data } = await apiClient.post<Book>(`/books/${bookId}/progress`, { current_page: currentPage });
  return data;
}

export async function finishReading(bookId: number, finishedAt: string, rating: number | null): Promise<Book> {
  const { data } = await apiClient.post<Book>(`/books/${bookId}/finish`, { finished_at: finishedAt, rating });
  return data;
}
