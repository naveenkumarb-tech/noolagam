import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { login } from "../api/auth";
import { tokenStorage } from "../api/tokenStorage";
import { httpError, networkError } from "../test/httpError";
import { LoginPage } from "./LoginPage";

vi.mock("../api/auth", () => ({ login: vi.fn() }));

const loginMock = vi.mocked(login);

function renderLoginPage(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Home screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
    tokenStorage.setAccessToken(null);
  });

  it("shows the message passed by the previous screen", () => {
    renderLoginPage({ successMessage: "Your password has been updated." });

    expect(screen.getByRole("status")).toHaveTextContent("Your password has been updated.");
  });

  it("shows no message when opened directly", () => {
    renderLoginPage();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("links to forgot password and sign up", () => {
    renderLoginPage();

    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
  });

  it("shows validation errors and does not call the API when the form is empty", async () => {
    renderLoginPage();

    await submit("", "");

    expect(await screen.findByText("Enter your email")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    renderLoginPage();

    await submit("not-an-email", "secret123");

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("stores the access token and goes to Home on success", async () => {
    loginMock.mockResolvedValue({ access_token: "token-1", token_type: "bearer" });
    renderLoginPage();

    await submit("  ravi@example.com ", "secret123");

    expect(await screen.findByText("Home screen")).toBeInTheDocument();
    expect(loginMock).toHaveBeenCalledWith({ email: "ravi@example.com", password: "secret123" });
    expect(tokenStorage.getAccessToken()).toBe("token-1");
  });

  it.each([
    [401, "That email and password don't match. Please try again."],
    [429, "Too many attempts. Please wait a few minutes and try again."],
    [500, "Something went wrong. Please try again."],
  ])("shows the right message for HTTP %i", async (status, message) => {
    loginMock.mockRejectedValue(httpError(status));
    renderLoginPage();

    await submit("ravi@example.com", "secret123");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("explains when the server cannot be reached", async () => {
    loginMock.mockRejectedValue(networkError());
    renderLoginPage();

    await submit("ravi@example.com", "secret123");

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
  });
});
