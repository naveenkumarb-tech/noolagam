import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  finishReading,
  getBookCounts,
  getCurrentlyReading,
  listBooks,
  startReading,
  updateProgress,
  type Book,
} from "../api/books";
import { getCurrentUser } from "../api/users";
import { greeting } from "../features/home/HomeHeader";
import { networkError } from "../test/httpError";
import { makeBook, renderWithProviders, SAMPLE_COUNTS, SAMPLE_USER } from "../test/renderWithProviders";
import { HomePage } from "./HomePage";

vi.mock("../api/users", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../api/books", () => ({
  finishReading: vi.fn(),
  getBookCounts: vi.fn(),
  getCurrentlyReading: vi.fn(),
  listBooks: vi.fn(),
  startReading: vi.fn(),
  updateProgress: vi.fn(),
}));

function mockLists({ upNext = [] as Book[], recent = [] as Book[] }) {
  vi.mocked(listBooks).mockImplementation(async ({ status }) => {
    const items = status === "to_read" ? upNext : recent;
    return { items, total: items.length, page: 1, per_page: 5 };
  });
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(SAMPLE_USER);
    vi.mocked(getBookCounts).mockResolvedValue(SAMPLE_COUNTS);
    vi.mocked(getCurrentlyReading).mockResolvedValue([
      makeBook({ gifted_by: "Ravi" }),
      makeBook({ id: 2, title: "Atomic Habits", current_page: 198, page_count: 320, progress_percent: 62 }),
    ]);
    mockLists({});
  });

  it("greets by the time of day", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(14)).toBe("Good afternoon");
    expect(greeting(20)).toBe("Good evening");
  });

  it("shows books being read with their progress", async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByRole("link", { name: "Ponniyin Selvan" })).toBeInTheDocument();
    expect(screen.getByText("Atomic Habits")).toBeInTheDocument();
    expect(screen.getByText("2 books")).toBeInTheDocument();
    expect(screen.getByText("Page 186 of 420")).toBeInTheDocument();
    expect(screen.getByText("44%")).toBeInTheDocument();
    expect(screen.getByText("Gifted by Ravi")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progress in Ponniyin Selvan" })).toHaveAttribute(
      "aria-valuenow",
      "44",
    );
  });

  it("shows the page without a percent when the page count is unknown", async () => {
    vi.mocked(getCurrentlyReading).mockResolvedValue([makeBook({ page_count: null, progress_percent: null })]);
    renderWithProviders(<HomePage />);

    expect(await screen.findByText("Page 186")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows the counts", async () => {
    renderWithProviders(<HomePage />);

    const owned = (await screen.findByText("Books owned")).parentElement!;
    expect(within(owned).getByText("84")).toBeInTheDocument();
    expect(within(screen.getByText("Finished").parentElement!).getByText("52")).toBeInTheDocument();
    expect(within(screen.getByText("To read").parentElement!).getByText("30")).toBeInTheDocument();
    expect(within(screen.getByText("Received as gifts").parentElement!).getByText("17")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is being read", async () => {
    vi.mocked(getCurrentlyReading).mockResolvedValue([]);
    renderWithProviders(<HomePage />);

    expect(await screen.findByText("Nothing on your nightstand")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a book" })).toHaveAttribute("href", "/books/new");
  });

  it("updates the page from the dialog", async () => {
    vi.mocked(updateProgress).mockResolvedValue(makeBook());
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Update page for Ponniyin Selvan" }));
    const input = screen.getByLabelText("Current page (of 420)");
    expect(input).toHaveValue(186);
    await user.clear(input);
    await user.type(input, "250");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateProgress).toHaveBeenCalledWith(1, 250));
    await waitFor(() => expect(screen.queryByLabelText("Current page (of 420)")).not.toBeInTheDocument());
    await waitFor(() => expect(getCurrentlyReading).toHaveBeenCalledTimes(2));
  });

  it("does not accept a page past the end of the book", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Update page for Ponniyin Selvan" }));
    const input = screen.getByLabelText("Current page (of 420)");
    await user.clear(input);
    await user.type(input, "421");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("This book has 420 pages")).toBeInTheDocument();
    expect(updateProgress).not.toHaveBeenCalled();
  });

  it("does not accept an empty page", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Update page for Ponniyin Selvan" }));
    await user.clear(screen.getByLabelText("Current page (of 420)"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a page number")).toBeInTheDocument();
    expect(updateProgress).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and explains when saving fails", async () => {
    vi.mocked(updateProgress).mockRejectedValue(networkError());
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Update page for Ponniyin Selvan" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
    expect(screen.getByLabelText("Current page (of 420)")).toBeInTheDocument();
  });

  it("marks a book finished with a rating and the local date", async () => {
    vi.mocked(finishReading).mockResolvedValue(makeBook());
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Mark Ponniyin Selvan as finished" }));
    await user.click(screen.getByRole("button", { name: "4 out of 5" }));
    expect(screen.getByRole("button", { name: "4 out of 5" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Mark finished" }));

    await waitFor(() =>
      expect(finishReading).toHaveBeenCalledWith(1, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 4),
    );
  });

  it("allows finishing without a rating, and tapping a star again clears it", async () => {
    vi.mocked(finishReading).mockResolvedValue(makeBook());
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Mark Ponniyin Selvan as finished" }));
    await user.click(screen.getByRole("button", { name: "4 out of 5" }));
    await user.click(screen.getByRole("button", { name: "4 out of 5" }));
    await user.click(screen.getByRole("button", { name: "Mark finished" }));

    await waitFor(() => expect(finishReading).toHaveBeenCalledWith(1, expect.any(String), null));
  });

  it("closes a dialog with Cancel without saving", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Mark Ponniyin Selvan as finished" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Finished Ponniyin Selvan?")).not.toBeInTheDocument();
    expect(finishReading).not.toHaveBeenCalled();
  });

  it("starts a book from Up next in one tap", async () => {
    mockLists({ upNext: [makeBook({ id: 7, title: "Thirukkural", status: "to_read" })] });
    vi.mocked(startReading).mockResolvedValue(makeBook());
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Start reading Thirukkural" }));

    await waitFor(() => expect(startReading).toHaveBeenCalledWith(7, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)));
  });

  it("hides Up next when there is nothing to read next", async () => {
    renderWithProviders(<HomePage />);

    await screen.findByRole("link", { name: "Ponniyin Selvan" });
    await waitFor(() => expect(listBooks).toHaveBeenCalled());
    expect(screen.queryByText("Up next")).not.toBeInTheDocument();
  });

  it("lists recently added books with their status", async () => {
    mockLists({
      recent: [
        makeBook({ id: 3, title: "Wings of Fire", status: "finished", rating: 5, gifted_by: "Priya" }),
        makeBook({ id: 4, title: "The Alchemist", status: "to_read" }),
      ],
    });
    renderWithProviders(<HomePage />);

    expect(await screen.findByText("Wings of Fire")).toBeInTheDocument();
    expect(screen.getByText("Finished · ★ 5")).toBeInTheDocument();
    expect(screen.getByText("Priya")).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveTextContent("To read");
    expect(screen.getByRole("table")).toHaveTextContent("—");
  });

  it("shows an error with a retry when a section fails to load", async () => {
    vi.mocked(getCurrentlyReading).mockRejectedValueOnce(networkError());
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Ponniyin Selvan" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
