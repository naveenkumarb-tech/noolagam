import { describe, expect, it } from "vitest";

import { isValidIsbn, normalizeIsbn } from "./isbn";

describe("isbn", () => {
  it.each(["9780735211292", "978-0-7352-1129-2", " 978 0735211292 ", "0735211299", "0-8044-2957-x"])(
    "accepts %s",
    (value) => {
      expect(isValidIsbn(value)).toBe(true);
    },
  );

  it.each(["", "abc", "123", "9780735211293", "0735211298", "97807352112921", "978073521129X"])(
    "rejects '%s'",
    (value) => {
      expect(isValidIsbn(value)).toBe(false);
    },
  );

  it("removes spaces and hyphens and uppercases the check digit", () => {
    expect(normalizeIsbn(" 0-8044-2957-x ")).toBe("080442957X");
  });
});
