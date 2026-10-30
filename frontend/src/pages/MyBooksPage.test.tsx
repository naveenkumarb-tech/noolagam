import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBookCounts, getBookFacets, listBooks, searchBooks, type BookPage } from "../api/books";
import { httpError, networkError } from "../test/httpError";
import { makeBook, renderWithProviders, SAMPLE_COUNTS } from "../test/renderWithProviders";
import { MyBooksPage } from "./MyBooksPage";

vi.mock("../api/books", () => ({
  getBookCounts: vi.fn(),
  getBookFacets: vi.fn(),
  listBooks: vi.fn(),
  searchBooks: vi.fn(),
}));

function page(titles: string[], total = titles.length, pageNumber = 1): BookPage {
  return {
    items: titles.map((title, index) => makeBook({ id: pageNumber * 100 + index, title })),
    total,
    page: pageNumber,
    per_page: 20,
  };
}

function CurrentUrl() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}

function renderPage(route = "/books") {
  return renderWithProviders(
    <>
      <MyBooksPage />
      <CurrentUrl />
    </>,
    { route },
  );
}

function lastListParams() {
  return vi.mocked(listBooks).mock.lastCall?.[0];
}

describe("MyBooksPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getBookCounts).mockResolvedValue(SAMPLE_COUNTS);
    vi.mocked(getBookFacets).mockResolvedValue({ authors: ["Kalki", "Sujatha"], gifted_by: ["Ravi"] });
    vi.mocked(listBooks).mockResolvedValue(page(["Wings of Fire", "Atomic Habits"]));
    vi.mocked(searchBooks).mockResolvedValue(page(["Found book"]));
  });

  it("lists books with their status and gift, linking to each book", async () => {
    vi.mocked(listBooks).mockResolvedValue({
      items: [makeBook({ id: 9, title: "Ponniyin Selvan", gifted_by: "Ravi" })],
      total: 1,
      page: 1,
      per_page: 20,
    });
    renderPage();

    const row = await screen.findByRole("link", { name: /Ponniyin Selvan/ });
    expect(row).toHaveAttribute("href", "/books/9");
    expect(within(row).getByText("Reading · 44%")).toBeInTheDocument();
    expect(within(row).getByText("Gift · Ravi")).toBeInTheDocument();
  });

  it("shows the count on every status tab", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: /^All\s*84$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^To read\s*30$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Reading\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Finished\s*52$/ })).toBeInTheDocument();
  });

  it("filters by status, and All removes the filter", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /^Finished/ }));
    await waitFor(() => expect(lastListParams()).toMatchObject({ status: "finished" }));
    expect(screen.getByTestId("url")).toHaveTextContent("status=finished");

    await user.click(screen.getByRole("button", { name: /^All/ }));
    await waitFor(() => expect(lastListParams()?.status).toBeUndefined());
  });

  it("filters by author and by who gifted the book", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("option", { name: "Kalki" });
    await user.selectOptions(screen.getByLabelText("Filter by author"), "Kalki");
    await waitFor(() => expect(lastListParams()).toMatchObject({ author: "Kalki" }));

    await user.selectOptions(screen.getByLabelText("Filter by who gifted the book"), "Ravi");
    await waitFor(() => expect(lastListParams()).toMatchObject({ author: "Kalki", gifted_by: "Ravi" }));
  });

  it("sorts, and leaves the default out of the address", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("link", { name: /Wings of Fire/ });
    await user.selectOptions(screen.getByLabelText("Sort books"), "title");
    await waitFor(() => expect(lastListParams()).toMatchObject({ sort: "title" }));
    expect(screen.getByTestId("url")).toHaveTextContent("sort=title");

    await user.selectOptions(screen.getByLabelText("Sort books"), "recent");
    await waitFor(() => expect(screen.getByTestId("url")).toBeEmptyDOMElement());
  });

  it("restores the filters from the address when coming back", async () => {
    renderPage("/books?status=reading&author=Kalki&sort=author");

    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ status: "reading", author: "Kalki", sort: "author" }),
    );
    expect(screen.getByLabelText("Filter by author")).toHaveValue("Kalki");
    expect(screen.getByLabelText("Sort books")).toHaveValue("author");
  });

  it("ignores values in the address that are not valid", async () => {
    renderPage("/books?status=lost&sort=price");

    await waitFor(() => expect(listBooks).toHaveBeenCalled());
    expect(lastListParams()?.status).toBeUndefined();
    expect(lastListParams()?.sort).toBe("recent");
  });

  it("keeps a filter visible even if that author no longer has books", async () => {
    renderPage("/books?author=Gone");

    await screen.findByRole("option", { name: "Kalki" });
    expect(screen.getByLabelText("Filter by author")).toHaveValue("Gone");
  });

  it("searches after a pause in typing, not on every key", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Search books"), "kalki");

    expect(await screen.findByRole("link", { name: /Found book/ })).toBeInTheDocument();
    expect(searchBooks).toHaveBeenCalledTimes(1);
    expect(vi.mocked(searchBooks).mock.calls[0][0]).toBe("kalki");
    expect(screen.getByText("1 book found")).toBeInTheDocument();
  });

  it("searches from a link with a query, such as the laptop header", async () => {
    renderPage("/books?q=atomic");

    await screen.findByRole("link", { name: /Found book/ });
    expect(screen.getByLabelText("Search books")).toHaveValue("atomic");
    expect(listBooks).not.toHaveBeenCalled();
  });

  it("combines search with filters, and shows that sort doesn't apply", async () => {
    renderPage("/books?q=atomic&status=reading&sort=title");

    await screen.findByRole("link", { name: /Found book/ });
    expect(vi.mocked(searchBooks).mock.calls[0][1]).toMatchObject({ status: "reading" });
    expect(vi.mocked(searchBooks).mock.calls[0][1]).not.toHaveProperty("sort");
    expect(screen.getByLabelText("Sort books")).toBeDisabled();
    expect(screen.getByRole("option", { name: "Sort: Best match" })).toBeInTheDocument();
  });

  it("clearing the search goes back to the full list", async () => {
    const user = userEvent.setup();
    renderPage("/books?q=atomic");

    await screen.findByRole("link", { name: /Found book/ });
    await user.clear(screen.getByLabelText("Search books"));

    expect(await screen.findByRole("link", { name: /Wings of Fire/ })).toBeInTheDocument();
  });

  it("loads the next page and keeps the first", async () => {
    vi.mocked(listBooks).mockImplementation(async ({ page: number }) =>
      number === 1 ? page(["First"], 21) : page(["Second"], 21, 2),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("link", { name: /Second/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /First/ })).toBeInTheDocument();
    expect(lastListParams()).toMatchObject({ page: 2 });
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("explains when the next page fails and allows another try", async () => {
    vi.mocked(listBooks).mockResolvedValueOnce(page(["First"], 21)).mockRejectedValueOnce(networkError());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByText("We couldn't load more books.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /First/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });

  it("shows an empty shelf with a way to add a book", async () => {
    vi.mocked(listBooks).mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText("Your shelf is empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a book" })).toHaveAttribute("href", "/books/new");
  });

  it("offers to clear filters when nothing matches", async () => {
    vi.mocked(searchBooks).mockResolvedValue(page([]));
    const user = userEvent.setup();
    renderPage("/books?q=nothing&status=reading");

    expect(await screen.findByText("No books match")).toBeInTheDocument();
    expect(screen.getByText("0 books found")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(await screen.findByRole("link", { name: /Wings of Fire/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Search books")).toHaveValue("");
    expect(screen.getByTestId("url")).toBeEmptyDOMElement();
  });

  it("shows an error with a retry", async () => {
    vi.mocked(listBooks).mockRejectedValueOnce(httpError(500));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: /Wings of Fire/ })).toBeInTheDocument();
  });
});
