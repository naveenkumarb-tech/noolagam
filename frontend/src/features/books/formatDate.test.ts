import { describe, expect, it } from "vitest";

import { formatBookDate } from "./formatDate";

const NOW = new Date(2026, 9, 30);

describe("formatBookDate", () => {
  it("leaves out the year for this year", () => {
    expect(formatBookDate("2026-10-12", NOW)).toBe("12 Oct");
  });

  it("includes the year for other years", () => {
    expect(formatBookDate("2019-04-01", NOW)).toBe("1 Apr 2019");
  });

  it("does not shift the first day of the year to the previous one", () => {
    expect(formatBookDate("2026-01-01", NOW)).toBe("1 Jan");
  });
});
