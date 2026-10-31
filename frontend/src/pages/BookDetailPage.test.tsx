import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteBook,
  finishReading,
  getBook,
  resetBook,
  startReading,
  updateBook,
  updateProgress,
  type Book,
} from "../api/books";
import { localDate } from "../features/books/localDate";
import { httpError, networkError } from "../test/httpError";
import { makeBook, renderWithProviders } from "../test/renderWithProviders";
import { BookDetailPage } from "./BookDetailPage";

vi.mock("../api/books", () => ({
  deleteBook: vi.fn(),
  finishReading: vi.fn(),
  getBook: vi.fn(),
  resetBook: vi.fn(),
  startReading: vi.fn(),
  updateBook: vi.fn(),
  updateProgress: vi.fn(),
}));

function renderPage(book?: Partial<Book>, route = "/books/1") {
  if (book) vi.mocked(getBook).mockResolvedValue(makeBook(book));
  return renderWithProviders(
    <Routes>
      <Route path="/books" element={<p>Books screen</p>} />
      <Route path="/books/:bookId" element={<BookDetailPage />} />
    </Routes>,
    { route },
  );
}

async function loaded() {
  return screen.findByRole("heading", { level: 1 });
}

describe("BookDetailPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows the book's details", async () => {
    renderPage({ gifted_by: "Ravi", started_at: "2019-10-12", description: "A Chola epic.", isbn: "9780735211292" });

    expect(await loaded()).toHaveTextContent("Ponniyin Selvan");
    expect(screen.getByText("Kalki")).toBeInTheDocument();
    expect(screen.getByText("Reading · 44%")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("12 Oct 2019")).toBeInTheDocument();
    expect(screen.getByText("420")).toBeInTheDocument();
    expect(screen.getByText("A Chola epic.")).toBeInTheDocument();
    expect(screen.getByText("ISBN 9780735211292")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/books/1/edit");
    expect(getBook).toHaveBeenCalledWith(1);
  });

  it("uses a dash for details that are not known", async () => {
    renderPage({ status: "to_read", gifted_by: null, started_at: null, page_count: null, progress_percent: null });

    await loaded();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText("About this book")).not.toBeInTheDocument();
  });

  it("collapses a long description", async () => {
    const user = userEvent.setup();
    renderPage({ description: "Long ".repeat(60) });

    await user.click(await screen.findByRole("button", { name: "Show more" }));

    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  });

  it("explains a book that does not exist", async () => {
    vi.mocked(getBook).mockRejectedValue(httpError(404));
    renderPage();

    expect(await screen.findByText("Book not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to My books" })).toHaveAttribute("href", "/books");
  });

  it("treats a malformed address as not found", async () => {
    vi.mocked(getBook).mockRejectedValue(httpError(422));
    renderPage(undefined, "/books/abc");

    expect(await screen.findByText("Book not found")).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    vi.mocked(getBook).mockRejectedValueOnce(networkError()).mockResolvedValueOnce(makeBook());
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await loaded()).toHaveTextContent("Ponniyin Selvan");
  });

  it("goes to My books from Back when opened directly", async () => {
    const user = userEvent.setup();
    renderPage({});

    await user.click(await screen.findByRole("button", { name: "Back to books" }));

    expect(await screen.findByText("Books screen")).toBeInTheDocument();
  });

  describe("a book to read", () => {
    it("can be started, and has nothing to move back or update", async () => {
      vi.mocked(startReading).mockResolvedValue(makeBook());
      const user = userEvent.setup();
      renderPage({ status: "to_read", current_page: 0, progress_percent: 0 });

      await user.click(await screen.findByRole("button", { name: "Start reading" }));

      await waitFor(() => expect(startReading).toHaveBeenCalledWith(1, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)));
      expect(screen.queryByRole("button", { name: "Move back to To-read" })).not.toBeInTheDocument();
      expect(screen.queryByText("Progress")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Mark as finished" })).not.toBeInTheDocument();
    });
  });

  describe("a book being read", () => {
    it("shows progress and updates the page", async () => {
      vi.mocked(updateProgress).mockResolvedValue(makeBook());
      const user = userEvent.setup();
      renderPage({});

      const input = await screen.findByLabelText("Current page (of 420)");
      expect(input).toHaveValue(186);
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "44");
      await user.clear(input);
      await user.type(input, "200");
      await user.click(screen.getByRole("button", { name: "Update" }));

      await waitFor(() => expect(updateProgress).toHaveBeenCalledWith(1, 200));
    });

    it("refuses a page past the end", async () => {
      const user = userEvent.setup();
      renderPage({});

      const input = await screen.findByLabelText("Current page (of 420)");
      await user.clear(input);
      await user.type(input, "421");
      await user.click(screen.getByRole("button", { name: "Update" }));

      expect(await screen.findByText("This book has 420 pages")).toBeInTheDocument();
      expect(updateProgress).not.toHaveBeenCalled();
    });

    it("can be marked finished with a rating", async () => {
      vi.mocked(finishReading).mockResolvedValue(makeBook());
      const user = userEvent.setup();
      renderPage({});

      await user.click(await screen.findByRole("button", { name: "Mark as finished" }));
      await user.click(screen.getByRole("button", { name: "5 out of 5" }));
      await user.click(screen.getByRole("button", { name: "Mark finished" }));

      await waitFor(() => expect(finishReading).toHaveBeenCalledWith(1, expect.any(String), 5));
    });
  });

  describe("a finished book", () => {
    const finished = { status: "finished", finished_at: "2019-04-01", rating: 3, progress_percent: 100 } as const;

    it("shows when it was finished and has no page input", async () => {
      renderPage(finished);

      expect(await screen.findByText("Finished on 1 Apr 2019")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "3 out of 5" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Start reading" })).not.toBeInTheDocument();
    });

    it("saves a changed rating straight away", async () => {
      vi.mocked(finishReading).mockResolvedValue(makeBook());
      const user = userEvent.setup();
      renderPage(finished);

      await user.click(await screen.findByRole("button", { name: "5 out of 5" }));

      await waitFor(() => expect(finishReading).toHaveBeenCalledWith(1, expect.any(String), 5));
    });

    it("can have its rating removed by tapping it again", async () => {
      vi.mocked(finishReading).mockResolvedValue(makeBook());
      const user = userEvent.setup();
      renderPage(finished);

      await user.click(await screen.findByRole("button", { name: "3 out of 5" }));

      await waitFor(() => expect(finishReading).toHaveBeenCalledWith(1, expect.any(String), null));
    });
  });

  describe("moving back to To-read", () => {
    it("asks first, because it clears dates and progress", async () => {
      vi.mocked(resetBook).mockResolvedValue(makeBook());
      const user = userEvent.setup();
      renderPage({});

      await user.click(await screen.findByRole("button", { name: "Move back to To-read" }));
      expect(screen.getByText(/clears your reading dates, progress and rating/)).toBeInTheDocument();
      expect(resetBook).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Move back" }));

      await waitFor(() => expect(resetBook).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByText(/clears your reading dates/)).not.toBeInTheDocument());
    });

    it("does nothing on Cancel", async () => {
      const user = userEvent.setup();
      renderPage({});

      await user.click(await screen.findByRole("button", { name: "Move back to To-read" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(resetBook).not.toHaveBeenCalled();
    });
  });

  describe("deleting", () => {
    it("asks first, then goes to My books", async () => {
      vi.mocked(deleteBook).mockResolvedValue();
      const user = userEvent.setup();
      renderPage({});

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      expect(screen.getByText(/It can't be undone/)).toBeInTheDocument();
      expect(deleteBook).not.toHaveBeenCalled();
      await user.click(screen.getByRole("dialog").querySelector("button:last-child")!);

      expect(await screen.findByText("Books screen")).toBeInTheDocument();
      expect(deleteBook).toHaveBeenCalledWith(1);
      expect(getBook).toHaveBeenCalledTimes(1);
    });

    it("stays and explains when deleting fails", async () => {
      vi.mocked(deleteBook).mockRejectedValue(networkError());
      const user = userEvent.setup();
      renderPage({});

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      await user.click(screen.getByRole("dialog").querySelector("button:last-child")!);

      expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
      expect(screen.queryByText("Books screen")).not.toBeInTheDocument();
    });
  });

  describe("notes", () => {
    it("saves when the field loses focus", async () => {
      vi.mocked(updateBook).mockResolvedValue(makeBook());
      const user = userEvent.setup();
      renderPage({});

      await user.type(await screen.findByLabelText("My notes"), "Loved Vandiyathevan");
      expect(updateBook).not.toHaveBeenCalled();
      await user.tab();

      await waitFor(() => expect(updateBook).toHaveBeenCalledWith(1, { notes: "Loved Vandiyathevan" }));
      expect(await screen.findByText("Saved")).toBeInTheDocument();
    });

    it("does not save when nothing changed", async () => {
      const user = userEvent.setup();
      renderPage({ notes: "Existing" });

      const notes = await screen.findByLabelText("My notes");
      expect(notes).toHaveValue("Existing");
      await user.click(notes);
      await user.tab();

      expect(updateBook).not.toHaveBeenCalled();
    });

    it("clears the notes when emptied", async () => {
      vi.mocked(updateBook).mockResolvedValue(makeBook());
      const user = userEvent.setup();
      renderPage({ notes: "Existing" });

      await user.clear(await screen.findByLabelText("My notes"));
      await user.tab();

      await waitFor(() => expect(updateBook).toHaveBeenCalledWith(1, { notes: null }));
    });

    it("keeps the text and says so when saving fails", async () => {
      vi.mocked(updateBook).mockRejectedValue(networkError());
      const user = userEvent.setup();
      renderPage({});

      const notes = await screen.findByLabelText("My notes");
      await user.type(notes, "Important thought");
      await user.tab();

      expect(await screen.findByRole("alert")).toHaveTextContent("Your notes were not saved");
      expect(notes).toHaveValue("Important thought");
    });
  });

  it("shows how long a finished book took to read", async () => {
    renderPage({ status: "finished", started_at: "2026-10-01", finished_at: "2026-10-13" });
    await loaded();

    expect(screen.getByText("Read in 12 days")).toBeInTheDocument();
  });

  it("shows how long a book has been read so far", async () => {
    renderPage({ status: "reading", started_at: localDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)) });
    await loaded();

    expect(screen.getByText(/^Reading for [456] days$/)).toBeInTheDocument();
  });

  it("shows no reading time before a book is started", async () => {
    renderPage({ status: "to_read", started_at: null });
    await loaded();

    expect(screen.queryByText(/Read in|Reading for|Started today/)).not.toBeInTheDocument();
  });
});
