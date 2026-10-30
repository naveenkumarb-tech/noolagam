import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getStats, type Stats } from "../api/stats";
import { networkError } from "../test/httpError";
import { renderWithProviders } from "../test/renderWithProviders";
import { StatsPage } from "./StatsPage";

vi.mock("../api/stats", () => ({ getStats: vi.fn() }));

const THIS_YEAR = new Date().getFullYear();

function makeStats(overrides: Partial<Stats> = {}): Stats {
  return {
    total_books: 84,
    finished: 52,
    currently_reading: 2,
    to_read: 30,
    gifted_books: 17,
    year: THIS_YEAR,
    available_years: [THIS_YEAR, 2019],
    finished_this_year: 18,
    pages_read_this_year: 6240,
    avg_days_per_book: 14,
    finished_by_month: Array.from({ length: 12 }, (_, index) => ({
      month: `${THIS_YEAR}-${String(index + 1).padStart(2, "0")}`,
      count: index === 0 ? 3 : 0,
    })),
    top_authors: [
      { author: "Kalki", count: 6 },
      { author: "Sujatha", count: 3 },
    ],
    gifted_by: [{ name: "Ravi", count: 4 }],
    ...overrides,
  };
}

function tile(label: string) {
  return within(screen.getByText(label, { selector: "dt" }).parentElement!);
}

describe("StatsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getStats).mockResolvedValue(makeStats());
  });

  it("asks for the reader's current year and shows the three figures", async () => {
    renderWithProviders(<StatsPage />);

    await screen.findByText("Books finished", { selector: "dt" });
    expect(getStats).toHaveBeenCalledWith(THIS_YEAR);
    expect(tile("Books finished").getByText("18")).toBeInTheDocument();
    expect(tile("Pages read").getByText("6,240")).toBeInTheDocument();
    expect(tile("Avg days per book").getByText("14")).toBeInTheDocument();
  });

  it("uses a dash when no average can be worked out", async () => {
    vi.mocked(getStats).mockResolvedValue(makeStats({ avg_days_per_book: null }));
    renderWithProviders(<StatsPage />);

    await screen.findByText("Avg days per book");
    expect(tile("Avg days per book").getByText("—")).toBeInTheDocument();
  });

  it("gives every month's value in a table for screen readers", async () => {
    renderWithProviders(<StatsPage />);

    const table = await screen.findByRole("table", { name: "Books finished per month" });
    expect(within(table).getAllByRole("row")).toHaveLength(13);
    expect(within(table).getByRole("row", { name: "January 3" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "December 0" })).toBeInTheDocument();
  });

  it("lists top authors with their counts and bars scaled to the highest", async () => {
    renderWithProviders(<StatsPage />);

    await screen.findByText("Kalki");
    const rows = within(screen.getByText("Top authors").parentElement!).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Kalki");
    expect(rows[0]).toHaveTextContent("6");
    expect(rows[1]).toHaveTextContent("Sujatha");
    const bars = [...document.querySelectorAll<HTMLElement>("li span[style]")].map((bar) => bar.style.width);
    expect(bars).toEqual(["100%", "50%"]);
  });

  it("shows who gifted books", async () => {
    renderWithProviders(<StatsPage />);

    expect(await screen.findByText("Ravi · 4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more/ })).not.toBeInTheDocument();
  });

  it("collapses a long list of gifters until asked", async () => {
    const gifted_by = Array.from({ length: 8 }, (_, index) => ({ name: `Person ${index}`, count: 1 }));
    vi.mocked(getStats).mockResolvedValue(makeStats({ gifted_by }));
    const user = userEvent.setup();
    renderWithProviders(<StatsPage />);

    await screen.findByText("Person 5 · 1");
    expect(screen.queryByText("Person 6 · 1")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+2 more" }));

    expect(screen.getByText("Person 7 · 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more/ })).not.toBeInTheDocument();
  });

  it("changes year from the years that have data", async () => {
    vi.mocked(getStats).mockImplementation(async (year) =>
      makeStats({ year, finished_this_year: year === 2019 ? 5 : 18 }),
    );
    const user = userEvent.setup();
    renderWithProviders(<StatsPage />);

    await screen.findByRole("option", { name: "2019" });
    await user.selectOptions(screen.getByLabelText("Year"), "2019");

    await waitFor(() => expect(tile("Books finished").getByText("5")).toBeInTheDocument());
    expect(getStats).toHaveBeenLastCalledWith(2019);
    expect(screen.getByLabelText("Year")).toHaveValue("2019");
  });

  it("explains a year with no finished books, while still showing gifts", async () => {
    vi.mocked(getStats).mockResolvedValue(
      makeStats({ finished_this_year: 0, pages_read_this_year: 0, avg_days_per_book: null, top_authors: [] }),
    );
    renderWithProviders(<StatsPage />);

    expect(await screen.findByText(`No books finished in ${THIS_YEAR}`)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Top authors")).not.toBeInTheDocument();
    expect(screen.getByText("Ravi · 4")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add a book" })).not.toBeInTheDocument();
  });

  it("points a new reader to adding a book", async () => {
    vi.mocked(getStats).mockResolvedValue(
      makeStats({
        total_books: 0,
        finished_this_year: 0,
        pages_read_this_year: 0,
        avg_days_per_book: null,
        top_authors: [],
        gifted_by: [],
      }),
    );
    renderWithProviders(<StatsPage />);

    expect(await screen.findByRole("link", { name: "Add a book" })).toHaveAttribute("href", "/books/new");
    expect(screen.queryByText("Books gifted by")).not.toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    vi.mocked(getStats).mockRejectedValueOnce(networkError());
    const user = userEvent.setup();
    renderWithProviders(<StatsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Books finished", { selector: "dt" })).toBeInTheDocument();
  });
});
