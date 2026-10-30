import { describe, expect, it } from "vitest";

import { httpError, networkError } from "../test/httpError";
import { apiErrorMessage } from "./errors";

describe("apiErrorMessage", () => {
  it("uses the server's message for a client error", () => {
    expect(apiErrorMessage(httpError(422, "The page is too high"))).toBe("The page is too high");
  });

  it("prefers a message chosen by the caller", () => {
    expect(apiErrorMessage(httpError(401, "From server"), { 401: "From caller" })).toBe("From caller");
  });

  it("never shows a server error's details", () => {
    expect(apiErrorMessage(httpError(500, "stack trace"))).toBe("Something went wrong. Please try again.");
  });

  it("explains rate limits and lost connections", () => {
    expect(apiErrorMessage(httpError(429, "x"))).toContain("Too many attempts");
    expect(apiErrorMessage(networkError())).toContain("couldn't reach the server");
  });

  it("handles errors that did not come from the API", () => {
    expect(apiErrorMessage(new Error("boom"))).toBe("Something went wrong. Please try again.");
  });
});
