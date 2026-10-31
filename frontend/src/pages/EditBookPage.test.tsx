import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBook, updateBook, uploadCover, type Book } from "../api/books";
import { httpError } from "../test/httpError";
import { makeBook, renderWithProviders } from "../test/renderWithProviders";
import { EditBookPage } from "./EditBookPage";

vi.mock("../api/books", () => ({ getBook: vi.fn(), updateBook: vi.fn(), uploadCover: vi.fn() }));

function renderPage(book: Partial<Book> = {}) {
  vi.mocked(getBook).mockResolvedValue(makeBook(book));
  renderWithProviders(
    <Routes>
      <Route path="/books/:bookId" element={<p>Book screen</p>} />
      <Route path="/books/:bookId/edit" element={<EditBookPage />} />
    </Routes>,
    { route: "/books/1/edit" },
  );
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Save changes" }));
}

describe("EditBookPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(updateBook).mockResolvedValue(makeBook());
  });

  it("starts with the book's current details", async () => {
    renderPage({ gifted_by: "Ravi", isbn: "9780735211292", description: "Epic" });

    expect(await screen.findByLabelText("Title")).toHaveValue("Ponniyin Selvan");
    expect(screen.getByLabelText("Author")).toHaveValue("Kalki");
    expect(screen.getByLabelText("Pages")).toHaveValue("420");
    expect(screen.getByLabelText("Gifted by")).toHaveValue("Ravi");
    expect(screen.getByLabelText("ISBN")).toHaveValue("9780735211292");
    expect(screen.getByLabelText("Description")).toHaveValue("Epic");
    expect(screen.getByLabelText("Started on")).toHaveValue("2026-10-01");
  });

  it("saves the changes and returns to the book", async () => {
    const user = userEvent.setup();
    renderPage({ gifted_by: "Ravi" });

    const title = await screen.findByLabelText("Title");
    await user.clear(title);
    await user.type(title, "New title");
    await user.clear(screen.getByLabelText("Gifted by"));
    await save(user);

    expect(await screen.findByText("Book screen")).toBeInTheDocument();
    expect(vi.mocked(updateBook).mock.calls[0]).toEqual([
      1,
      expect.objectContaining({ title: "New title", gifted_by: null, page_count: 420 }),
    ]);
  });

  it("does not send dates for a book to read, and hides those fields", async () => {
    const user = userEvent.setup();
    renderPage({ status: "to_read", started_at: null });

    await screen.findByLabelText("Title");
    expect(screen.queryByLabelText("Started on")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Finished on")).not.toBeInTheDocument();
    await save(user);

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    const changes = vi.mocked(updateBook).mock.calls[0][1];
    expect(changes.started_at).toBeUndefined();
    expect(changes.finished_at).toBeUndefined();
  });

  it("corrects the dates of a finished book", async () => {
    const user = userEvent.setup();
    renderPage({ status: "finished", started_at: "2019-01-01", finished_at: "2019-02-01" });

    const finished = await screen.findByLabelText("Finished on");
    await user.clear(finished);
    await user.type(finished, "2019-03-01");
    await save(user);

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(vi.mocked(updateBook).mock.calls[0][1]).toMatchObject({
      started_at: "2019-01-01",
      finished_at: "2019-03-01",
    });
  });

  it("refuses a finish date before the start date", async () => {
    const user = userEvent.setup();
    renderPage({ status: "finished", started_at: "2019-02-01", finished_at: "2019-03-01" });

    const finished = await screen.findByLabelText("Finished on");
    await user.clear(finished);
    await user.type(finished, "2019-01-01");
    await save(user);

    expect(await screen.findByText("This is before the date you started")).toBeInTheDocument();
    expect(updateBook).not.toHaveBeenCalled();
  });

  it("refuses a future date and an empty required date", async () => {
    const user = userEvent.setup();
    renderPage();

    const started = await screen.findByLabelText("Started on");
    await user.clear(started);
    await save(user);
    expect(await screen.findByText("Choose a date")).toBeInTheDocument();

    await user.type(started, "2999-01-01");
    await save(user);
    expect(await screen.findByText("This date is in the future")).toBeInTheDocument();
    expect(updateBook).not.toHaveBeenCalled();
  });

  it("validates the same fields as adding a book", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.clear(await screen.findByLabelText("Title"));
    await user.clear(screen.getByLabelText("Author"));
    await user.clear(screen.getByLabelText("Pages"));
    await user.type(screen.getByLabelText("Pages"), "abc");
    await user.type(screen.getByLabelText("ISBN"), "123");
    await save(user);

    expect(await screen.findByText("Enter the title")).toBeInTheDocument();
    expect(screen.getByText("Enter the author")).toBeInTheDocument();
    expect(screen.getByText("Enter a number from 1 to 100,000")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid 10 or 13 digit ISBN")).toBeInTheDocument();
  });

  it("shows the server's reason and keeps the edits", async () => {
    vi.mocked(updateBook).mockRejectedValue(
      httpError(422, "The current page cannot be higher than the book's page count"),
    );
    const user = userEvent.setup();
    renderPage();

    const pages = await screen.findByLabelText("Pages");
    await user.clear(pages);
    await user.type(pages, "10");
    await save(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("cannot be higher than the book's page count");
    expect(pages).toHaveValue("10");
  });

  it("returns to the book from Back without saving", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Back to book" }));

    expect(await screen.findByText("Book screen")).toBeInTheDocument();
    expect(updateBook).not.toHaveBeenCalled();
  });

  it("explains a book that does not exist", async () => {
    vi.mocked(getBook).mockRejectedValue(httpError(404));
    renderWithProviders(
      <Routes>
        <Route path="/books/:bookId/edit" element={<EditBookPage />} />
      </Routes>,
      { route: "/books/1/edit" },
    );

    expect(await screen.findByText("Book not found")).toBeInTheDocument();
  });

  describe("cover photo", () => {
    const photo = new File(["photo"], "cover.jpg", { type: "image/jpeg" });

    it("shows the current cover", async () => {
      renderPage({ cover_url: "/api/v1/media/covers/abc.jpg" });

      await screen.findByLabelText("Title");
      expect(document.querySelector("img")).toHaveAttribute("src", "/api/v1/media/covers/abc.jpg");
    });

    it("uploads a new photo with the changes, then returns to the book", async () => {
      const user = userEvent.setup();
      vi.mocked(uploadCover).mockResolvedValue(makeBook());
      renderPage();

      await screen.findByLabelText("Title");
      await user.upload(screen.getByLabelText("Photo from files"), photo);
      await screen.findByText(/New photo chosen/);
      await save(user);

      expect(await screen.findByText("Book screen")).toBeInTheDocument();
      expect(updateBook).toHaveBeenCalled();
      const [bookId, uploaded] = vi.mocked(uploadCover).mock.calls[0];
      expect(bookId).toBe(1);
      expect(uploaded.name).toBe(photo.name);
    });

    it("doesn't upload anything when no photo is chosen", async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByLabelText("Title");
      await save(user);

      expect(await screen.findByText("Book screen")).toBeInTheDocument();
      expect(uploadCover).not.toHaveBeenCalled();
    });

    it("stays on the page and explains when the photo fails", async () => {
      const user = userEvent.setup();
      vi.mocked(uploadCover).mockRejectedValue(httpError(413, "That photo is too large. Choose one under 15 MB"));
      renderPage();

      await screen.findByLabelText("Title");
      await user.upload(screen.getByLabelText("Photo from files"), photo);
      await screen.findByText(/New photo chosen/);
      await save(user);

      expect(await screen.findByText(/Your changes are saved, but the photo isn't/)).toHaveTextContent("under 15 MB");
      expect(screen.queryByText("Book screen")).not.toBeInTheDocument();
    });

    it("doesn't upload if the changes can't be saved", async () => {
      const user = userEvent.setup();
      vi.mocked(updateBook).mockRejectedValue(httpError(500));
      renderPage();

      await screen.findByLabelText("Title");
      await user.upload(screen.getByLabelText("Photo from files"), photo);
      await screen.findByText(/New photo chosen/);
      await save(user);

      await screen.findByRole("alert");
      expect(uploadCover).not.toHaveBeenCalled();
    });
  });
});
