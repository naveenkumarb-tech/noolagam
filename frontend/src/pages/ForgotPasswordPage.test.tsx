import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { forgotPassword } from "../api/auth";
import { httpError, networkError } from "../test/httpError";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

vi.mock("../api/auth", () => ({ forgotPassword: vi.fn() }));

const forgotPasswordMock = vi.mocked(forgotPassword);

function renderPage() {
  render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

async function submit(email: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Send reset link" }));
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    forgotPasswordMock.mockReset();
  });

  it("links back to log in and shows no message at first", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Back to log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("validates the email without calling the API", async () => {
    renderPage();

    await submit("");
    expect(await screen.findByText("Enter your email")).toBeInTheDocument();

    await submit("not-an-email");
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(forgotPasswordMock).not.toHaveBeenCalled();
  });

  it("shows the neutral inbox message after submitting", async () => {
    forgotPasswordMock.mockResolvedValue();
    renderPage();

    await submit(" ravi@example.com ");

    expect(await screen.findByText("Check your inbox.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "If an account exists for this email, a reset link is on its way. The link works once and expires in 30 minutes.",
    );
    expect(forgotPasswordMock).toHaveBeenCalledWith("ravi@example.com");
  });

  it.each([
    ["rate limited", httpError(429), "Too many attempts"],
    ["no connection", networkError(), "We couldn't reach the server"],
  ])("explains %s and does not claim the email was sent", async (_label, error, message) => {
    forgotPasswordMock.mockRejectedValue(error);
    renderPage();

    await submit("ravi@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
