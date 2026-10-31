import { screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBook, lookupBook, uploadCover, type BookLookup } from "../api/books";
import { localDate } from "../features/books/localDate";
import { httpError, networkError } from "../test/httpError";
import { makeBook, renderWithProviders } from "../test/renderWithProviders";
import { AddBookPage } from "./AddBookPage";

vi.mock("../api/books", () => ({ createBook: vi.fn(), lookupBook: vi.fn(), uploadCover: vi.fn() }));

const ISBN = "9780735211292";
const FOUND: BookLookup = {
  isbn: ISBN,
  title: "Atomic Habits",
  author: "James Clear",
  page_count: 320,
  cover_url: "https://covers.openlibrary.org/b/id/5-M.jpg",
  description: "Tiny changes.",
};

async function fillRequired(user: UserEvent, title = "Wings of Fire") {
  await user.type(screen.getByLabelText("Title"), title);
  await user.type(screen.getByLabelText("Author"), "Kalam");
}

async function save(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: "Save book" }));
}

async function lookUp(user: UserEvent, isbn = ISBN) {
  await user.type(screen.getByLabelText("Quick add with ISBN"), isbn);
  await user.click(screen.getByRole("button", { name: "Look up" }));
}

function savedBook() {
  return vi.mocked(createBook).mock.calls[0][0];
}

describe("AddBookPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createBook).mockImplementation(async (book) => makeBook({ title: book.title }));
    vi.mocked(uploadCover).mockImplementation(async (id) => makeBook({ id }));
  });

  it("requires a title and an author", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddBookPage />);

    await save(user);

    expect(await screen.findByText("Enter the title")).toBeInTheDocument();
    expect(screen.getByText("Enter the author")).toBeInTheDocument();
    expect(createBook).not.toHaveBeenCalled();
  });

  it("saves a manually entered book with blank optional fields left out", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddBookPage />);

    await fillRequired(user);
    await save(user);

    await waitFor(() => expect(createBook).toHaveBeenCalled());
    expect(savedBook()).toEqual({ title: "Wings of Fire", author: "Kalam", status: "to_read" });
  });

  it("saves pages and who gifted it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddBookPage />);

    await fillRequired(user);
    await user.type(screen.getByLabelText("Pages"), "180");
    await user.type(screen.getByLabelText("Gifted by"), "Priya");
    await save(user);

    await waitFor(() => expect(createBook).toHaveBeenCalled());
    expect(savedBook()).toMatchObject({ page_count: 180, gifted_by: "Priya" });
  });

  it.each(["0", "-5", "12.5", "abc", "100001"])("rejects %s pages", async (pages) => {
    const user = userEvent.setup();
    renderWithProviders(<AddBookPage />);

    await fillRequired(user);
    await user.type(screen.getByLabelText("Pages"), pages);
    await save(user);

    expect(await screen.findByText("Enter a number from 1 to 100,000")).toBeInTheDocument();
    expect(createBook).not.toHaveBeenCalled();
  });

  it("confirms, clears the form and stays ready for the next book", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddBookPage />);

    await fillRequired(user);
    await user.type(screen.getByLabelText("Gifted by"), "Priya");
    await save(user);

    expect(await screen.findByText("Wings of Fire")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "go to Home" })).toHaveAttribute("href", "/");
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Gifted by")).toHaveValue("");
  });

  it("keeps what was typed and explains when saving fails", async () => {
    vi.mocked(createBook).mockRejectedValue(networkError());
    const user = userEvent.setup();
    renderWithProviders(<AddBookPage />);

    await fillRequired(user);
    await save(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
    expect(screen.getByLabelText("Title")).toHaveValue("Wings of Fire");
  });

  describe("status", () => {
    it("asks for no date for a book to read", () => {
      renderWithProviders(<AddBookPage />);

      expect(screen.getByRole("button", { name: "To read" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByLabelText("Started on")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Finished on")).not.toBeInTheDocument();
    });

    it("sends the start date for a book being read, defaulting to today", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await fillRequired(user);
      await user.click(screen.getByRole("button", { name: "Reading" }));
      expect(screen.getByLabelText("Started on")).toHaveValue(localDate());
      await save(user);

      await waitFor(() => expect(createBook).toHaveBeenCalled());
      expect(savedBook()).toMatchObject({ status: "reading", started_at: localDate() });
      expect(savedBook().finished_at).toBeUndefined();
    });

    it("allows an old finish date and a rating, for books read long ago", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await fillRequired(user);
      await user.click(screen.getByRole("button", { name: "Finished" }));
      const date = screen.getByLabelText("Finished on");
      await user.clear(date);
      await user.type(date, "2019-04-01");
      await user.click(screen.getByRole("button", { name: "5 out of 5" }));
      await save(user);

      await waitFor(() => expect(createBook).toHaveBeenCalled());
      expect(savedBook()).toMatchObject({ status: "finished", finished_at: "2019-04-01", rating: 5 });
    });

    it("rejects a date in the future", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await fillRequired(user);
      await user.click(screen.getByRole("button", { name: "Finished" }));
      const date = screen.getByLabelText("Finished on");
      await user.clear(date);
      await user.type(date, "2999-01-01");
      await save(user);

      expect(await screen.findByText("This date is in the future")).toBeInTheDocument();
      expect(createBook).not.toHaveBeenCalled();
    });

    it("does not send a rating if the status changes away from finished", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await fillRequired(user);
      await user.click(screen.getByRole("button", { name: "Finished" }));
      await user.click(screen.getByRole("button", { name: "5 out of 5" }));
      await user.click(screen.getByRole("button", { name: "To read" }));
      await save(user);

      await waitFor(() => expect(createBook).toHaveBeenCalled());
      expect(savedBook()).toEqual({ title: "Wings of Fire", author: "Kalam", status: "to_read" });
    });
  });

  describe("ISBN lookup", () => {
    it("fills in the form and shows what it found", async () => {
      vi.mocked(lookupBook).mockResolvedValue(FOUND);
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await lookUp(user);

      expect(await screen.findByText("Found: Atomic Habits")).toBeInTheDocument();
      expect(screen.getByText("Tiny changes.")).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveValue("Atomic Habits");
      expect(screen.getByLabelText("Author")).toHaveValue("James Clear");
      expect(screen.getByLabelText("Pages")).toHaveValue("320");
    });

    it("saves the cover, description and clean ISBN from the lookup", async () => {
      vi.mocked(lookupBook).mockResolvedValue(FOUND);
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await lookUp(user, "978-0-7352-1129-2");
      await screen.findByText("Found: Atomic Habits");
      await save(user);

      await waitFor(() => expect(createBook).toHaveBeenCalled());
      expect(vi.mocked(lookupBook).mock.calls[0][0]).toBe(ISBN);
      expect(savedBook()).toMatchObject({
        isbn: ISBN,
        cover_url: FOUND.cover_url,
        description: FOUND.description,
        page_count: 320,
      });
    });

    it("keeps the user's edits to the filled-in details", async () => {
      vi.mocked(lookupBook).mockResolvedValue(FOUND);
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await lookUp(user);
      await screen.findByText("Found: Atomic Habits");
      await user.clear(screen.getByLabelText("Title"));
      await user.type(screen.getByLabelText("Title"), "My Title");
      await save(user);

      await waitFor(() => expect(createBook).toHaveBeenCalled());
      expect(savedBook().title).toBe("My Title");
    });

    it("drops the found cover when the ISBN is changed", async () => {
      vi.mocked(lookupBook).mockResolvedValue(FOUND);
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await lookUp(user);
      await screen.findByText("Found: Atomic Habits");
      await user.clear(screen.getByLabelText("Quick add with ISBN"));
      expect(screen.queryByText("Found: Atomic Habits")).not.toBeInTheDocument();
      await save(user);

      await waitFor(() => expect(createBook).toHaveBeenCalled());
      expect(savedBook().cover_url).toBeUndefined();
    });

    it("asks the user to fill in what the lookup did not find", async () => {
      vi.mocked(lookupBook).mockResolvedValue({ ...FOUND, author: null, page_count: null });
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await lookUp(user);

      expect(await screen.findByText("Please fill in what's missing below.")).toBeInTheDocument();
      expect(screen.getByLabelText("Author")).toHaveValue("");
    });

    it("looks up when Enter is pressed instead of saving the form", async () => {
      vi.mocked(lookupBook).mockResolvedValue(FOUND);
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await user.type(screen.getByLabelText("Quick add with ISBN"), `${ISBN}{Enter}`);

      expect(await screen.findByText("Found: Atomic Habits")).toBeInTheDocument();
      expect(createBook).not.toHaveBeenCalled();
    });

    it.each([
      ["", "Enter the ISBN to look up"],
      ["12345", "Enter a valid 10 or 13 digit ISBN"],
    ])("checks '%s' without calling the API", async (isbn, message) => {
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      if (isbn) await user.type(screen.getByLabelText("Quick add with ISBN"), isbn);
      await user.click(screen.getByRole("button", { name: "Look up" }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(lookupBook).not.toHaveBeenCalled();
    });

    it.each([
      [httpError(404), "We couldn't find this ISBN"],
      [httpError(503), "Book lookup isn't available right now"],
      [networkError(), "We couldn't reach the server"],
    ])("still allows manual entry when the lookup fails", async (error, message) => {
      vi.mocked(lookupBook).mockRejectedValue(error);
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await lookUp(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      await fillRequired(user);
      await save(user);
      await waitFor(() => expect(createBook).toHaveBeenCalled());
      expect(savedBook().isbn).toBe(ISBN);
    });

    it("clears a lookup error when the ISBN is changed", async () => {
      vi.mocked(lookupBook).mockRejectedValue(httpError(404));
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await lookUp(user);
      await screen.findByRole("alert");
      await user.type(screen.getByLabelText("Quick add with ISBN"), "1");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("will not save a book with an invalid ISBN", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await user.type(screen.getByLabelText("Quick add with ISBN"), "12345");
      await fillRequired(user);
      await save(user);

      expect(await screen.findByText("Enter a valid 10 or 13 digit ISBN")).toBeInTheDocument();
      expect(createBook).not.toHaveBeenCalled();
    });
  });

  describe("cover photo", () => {
    const photoFile = () => new File(["photo"], "cover.jpg", { type: "image/jpeg" });

    it("uploads the chosen photo to the new book", async () => {
      const user = userEvent.setup();
      const photo = photoFile();
      vi.mocked(createBook).mockResolvedValue(makeBook({ id: 7, title: "Wings of Fire" }));
      renderWithProviders(<AddBookPage />);

      await fillRequired(user);
      await user.upload(screen.getByLabelText("Photo from files"), photo);
      expect(await screen.findByText(/New photo chosen/)).toBeInTheDocument();
      await save(user);

      await waitFor(() => expect(uploadCover).toHaveBeenCalled());
      const [bookId, uploaded] = vi.mocked(uploadCover).mock.calls[0];
      expect(bookId).toBe(7);
      expect(uploaded.name).toBe("cover.jpg");
      expect(uploaded.type).toBe("image/jpeg");
      expect(await uploaded.text()).toBe("photo");
      expect(await screen.findByText(/is on your shelf\. Add another below/)).toBeInTheDocument();
      expect(screen.queryByText(/New photo chosen/)).not.toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveValue("");
    });

    it("can take the photo with the camera", async () => {
      const user = userEvent.setup();
      const photo = photoFile();
      vi.mocked(createBook).mockResolvedValue(makeBook({ id: 7 }));
      renderWithProviders(<AddBookPage />);

      const camera = screen.getByLabelText("Photo from camera");
      expect(camera).toHaveAttribute("capture", "environment");
      await fillRequired(user);
      await user.upload(camera, photo);
      await screen.findByText(/New photo chosen/);
      await save(user);

      await waitFor(() => expect(uploadCover).toHaveBeenCalled());
      expect(vi.mocked(uploadCover).mock.calls[0][1].name).toBe(photo.name);
    });

    it("opens the camera and the file chooser from their buttons", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);
      const openCamera = vi.spyOn(screen.getByLabelText<HTMLInputElement>("Photo from camera"), "click");
      const openFiles = vi.spyOn(screen.getByLabelText<HTMLInputElement>("Photo from files"), "click");

      await user.click(screen.getByRole("button", { name: "Take photo" }));
      await user.click(screen.getByRole("button", { name: "Choose photo" }));

      expect(openCamera).toHaveBeenCalledOnce();
      expect(openFiles).toHaveBeenCalledOnce();
    });

    it("doesn't upload anything when no photo is chosen", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await fillRequired(user);
      await save(user);

      await waitFor(() => expect(createBook).toHaveBeenCalled());
      expect(uploadCover).not.toHaveBeenCalled();
    });

    it("forgets a photo that was removed", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);

      await fillRequired(user);
      await user.upload(screen.getByLabelText("Photo from files"), photoFile());
      await user.click(await screen.findByRole("button", { name: "Remove photo" }));
      await save(user);

      await waitFor(() => expect(createBook).toHaveBeenCalled());
      expect(uploadCover).not.toHaveBeenCalled();
    });

    it("refuses a file type the server won't accept", async () => {
      const user = userEvent.setup({ applyAccept: false });
      renderWithProviders(<AddBookPage />);

      await user.upload(
        screen.getByLabelText("Photo from files"),
        new File(["x"], "scan.pdf", { type: "application/pdf" }),
      );

      expect(screen.getByRole("alert")).toHaveTextContent("Choose a JPEG, PNG or WebP photo");
      expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
    });

    it("refuses a photo that is too large, and keeps the one already chosen", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddBookPage />);
      await user.upload(screen.getByLabelText("Photo from files"), photoFile());
      await screen.findByRole("button", { name: "Remove photo" });

      const huge = photoFile();
      Object.defineProperty(huge, "size", { value: 16 * 1024 * 1024 });
      await user.upload(screen.getByLabelText("Photo from files"), huge);

      expect(screen.getByRole("alert")).toHaveTextContent("under 15 MB");
      expect(screen.getByRole("button", { name: "Remove photo" })).toBeInTheDocument();
    });

    it("leaves unknown file types for the server to judge, as some galleries don't report one", async () => {
      const user = userEvent.setup({ applyAccept: false });
      renderWithProviders(<AddBookPage />);

      await user.upload(screen.getByLabelText("Photo from files"), new File(["x"], "photo"));

      expect(await screen.findByRole("button", { name: "Remove photo" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("says so when the phone can't hand over the photo", async () => {
      const user = userEvent.setup();
      const unreadable = photoFile();
      unreadable.arrayBuffer = () => Promise.reject(new DOMException("Not readable", "NotReadableError"));
      renderWithProviders(<AddBookPage />);

      await user.upload(screen.getByLabelText("Photo from files"), unreadable);

      expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't read that photo");
      expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
    });

    it("keeps the book when the photo fails, says so, and doesn't offer to save it twice", async () => {
      const user = userEvent.setup();
      vi.mocked(createBook).mockResolvedValue(makeBook({ id: 7, title: "Wings of Fire" }));
      vi.mocked(uploadCover).mockRejectedValue(httpError(422, "Choose a JPEG, PNG or WebP photo"));
      renderWithProviders(<AddBookPage />);

      await fillRequired(user);
      await user.upload(screen.getByLabelText("Photo from files"), photoFile());
      await screen.findByText(/New photo chosen/);
      await save(user);

      expect(await screen.findByText(/but its photo wasn't saved/)).toHaveTextContent(
        "Choose a JPEG, PNG or WebP photo. Try again from Edit",
      );
      expect(screen.getByRole("link", { name: "Try again from Edit" })).toHaveAttribute("href", "/books/7/edit");
      expect(screen.getByLabelText("Title")).toHaveValue("");
      expect(createBook).toHaveBeenCalledOnce();
    });

    it("doesn't try to upload when the book itself can't be saved", async () => {
      const user = userEvent.setup();
      vi.mocked(createBook).mockRejectedValue(networkError());
      renderWithProviders(<AddBookPage />);

      await fillRequired(user);
      await user.upload(screen.getByLabelText("Photo from files"), photoFile());
      await screen.findByText(/New photo chosen/);
      await save(user);

      await screen.findByRole("alert");
      expect(uploadCover).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Remove photo" })).toBeInTheDocument();
    });

    it("sends the looked-up cover too, so the book keeps one if the photo fails", async () => {
      const user = userEvent.setup();
      vi.mocked(lookupBook).mockResolvedValue(FOUND);
      vi.mocked(createBook).mockResolvedValue(makeBook({ id: 7 }));
      renderWithProviders(<AddBookPage />);

      await lookUp(user);
      await screen.findByText(/Found:/);
      await user.upload(screen.getByLabelText("Photo from files"), photoFile());
      await screen.findByText(/New photo chosen/);
      await save(user);

      await waitFor(() => expect(uploadCover).toHaveBeenCalled());
      expect(savedBook().cover_url).toBe(FOUND.cover_url);
    });
  });
});
