import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";

import type { Book, BookCounts } from "../api/books";
import type { User } from "../api/users";
import { AuthStatusContext, type AuthStatus } from "../features/auth/AuthProvider";

type Options = {
  route?: string;
  status?: AuthStatus;
};

export function renderWithProviders(ui: ReactNode, { route = "/", status = "authenticated" }: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={queryClient}>
        <AuthStatusContext.Provider value={status}>{ui}</AuthStatusContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return queryClient;
}

export function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 1,
    title: "Ponniyin Selvan",
    author: "Kalki",
    isbn: null,
    cover_url: null,
    description: null,
    page_count: 420,
    current_page: 186,
    gifted_by: null,
    status: "reading",
    rating: null,
    notes: null,
    started_at: "2026-10-01",
    finished_at: null,
    created_at: "2026-10-01T00:00:00Z",
    progress_percent: 44,
    ...overrides,
  };
}

export const SAMPLE_COUNTS: BookCounts = { total: 84, to_read: 30, reading: 2, finished: 52, gifted: 17 };

export const SAMPLE_USER: User = { id: 1, name: "Ravi", email: "ravi@example.com" };
