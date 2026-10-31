import { describe, expect, it } from "vitest";

import { makeBook } from "../../test/renderWithProviders";
import { readingDays, readingTimeLabel } from "./readingTime";

const TODAY = "2026-10-31";
const finished = (started_at: string | null, finished_at: string | null) =>
  makeBook({ status: "finished", started_at, finished_at });
const reading = (started_at: string) => makeBook({ status: "reading", started_at });

describe("reading time", () => {
  it("counts the days from starting to finishing", () => {
    expect(readingTimeLabel(finished("2026-10-01", "2026-10-13"), TODAY)).toBe("Read in 12 days");
  });

  it("says a single day properly", () => {
    expect(readingTimeLabel(finished("2026-10-01", "2026-10-02"), TODAY)).toBe("Read in 1 day");
    expect(readingTimeLabel(reading("2026-10-30"), TODAY)).toBe("Reading for 1 day");
  });

  it("counts up to today for a book still being read", () => {
    expect(readingTimeLabel(reading("2026-10-01"), TODAY)).toBe("Reading for 30 days");
  });

  it("describes a book started today", () => {
    expect(readingDays(reading(TODAY), TODAY)).toBe(0);
    expect(readingTimeLabel(reading(TODAY), TODAY)).toBe("Started today");
  });

  it("doesn't claim a book was read in a day when both dates are the same", () => {
    expect(readingDays(finished("2026-10-01", "2026-10-01"), TODAY)).toBe(0);
    expect(readingTimeLabel(finished("2026-10-01", "2026-10-01"), TODAY)).toBe("Started and finished the same day");
  });

  it("counts across months, years and clock changes", () => {
    expect(readingDays(finished("2025-12-31", "2026-01-01"), TODAY)).toBe(1);
    expect(readingDays(finished("2024-02-28", "2024-03-01"), TODAY)).toBe(2);
    expect(readingDays(finished("2026-03-28", "2026-03-30"), TODAY)).toBe(2);
    expect(readingDays(finished("2026-10-24", "2026-10-26"), TODAY)).toBe(2);
  });

  it("ignores the date on the book when it hasn't been started", () => {
    expect(readingTimeLabel(makeBook({ status: "to_read", started_at: null }), TODAY)).toBeNull();
    expect(readingTimeLabel(finished(null, "2026-10-01"), TODAY)).toBeNull();
    expect(readingTimeLabel(finished("2026-10-01", null), TODAY)).toBeNull();
  });

  it("is never negative when the start date is ahead of this device's today", () => {
    expect(readingDays(reading("2026-11-01"), TODAY)).toBe(0);
  });
});
