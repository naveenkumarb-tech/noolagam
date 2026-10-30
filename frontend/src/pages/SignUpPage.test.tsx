import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { register } from "../api/auth";
import { tokenStorage } from "../api/tokenStorage";
import { httpError, networkError } from "../test/httpError";
import { SignUpPage } from "./SignUpPage";

vi.mock("../api/auth", () => ({ register: vi.fn() }));

const registerMock = vi.mocked(register);

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Routes>
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/login" element={<p>Login screen</p>} />
        <Route path="/" element={<p>Home screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

type Fields = { name?: string; email?: string; password?: string; confirm?: string };

async function fillAndSubmit({
  name = "Ravi",
  email = "ravi@example.com",
  password = "secret123",
  confirm = "secret123",
}: Fields = {}) {
  const user = userEvent.setup();
  if (name) await user.type(screen.getByLabelText("Name"), name);
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  if (confirm) await user.type(screen.getByLabelText("Confirm password"), confirm);
  await user.click(screen.getByRole("button", { name: "Create account" }));
  return user;
}

describe("SignUpPage", () => {
  beforeEach(() => {
    registerMock.mockReset();
    tokenStorage.setAccessToken(null);
  });

  it("links back to log in", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });

  it("shows validation errors for an empty form", async () => {
    renderPage();

    await fillAndSubmit({ name: "", email: "", password: "", confirm: "" });

    expect(await screen.findByText("Enter your name")).toBeInTheDocument();
    expect(screen.getByText("Enter your email")).toBeInTheDocument();
    expect(screen.getByText("Use at least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("Type your password again")).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    renderPage();

    await fillAndSubmit({ password: "short12", confirm: "short12" });

    expect(await screen.findByText("Use at least 8 characters")).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("accepts a password with no number or symbol", async () => {
    registerMock.mockResolvedValue({ access_token: "token-1", token_type: "bearer" });
    renderPage();

    await fillAndSubmit({ password: "onlyletters", confirm: "onlyletters" });

    expect(await screen.findByText("Home screen")).toBeInTheDocument();
  });

  it("measures the password limit in bytes, not characters", async () => {
    // 25 Tamil letters are only 25 characters but 75 bytes, over bcrypt's limit.
    const tamil = "த".repeat(25);
    renderPage();

    await fillAndSubmit({ password: tamil, confirm: tamil });

    expect(await screen.findByText("That password is too long")).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("rejects passwords that don't match, and clears the error once they do", async () => {
    renderPage();

    const user = await fillAndSubmit({ confirm: "different1" });

    expect(await screen.findByText("The passwords don't match")).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "different1");

    expect(screen.queryByText("The passwords don't match")).not.toBeInTheDocument();
  });

  it("sends the account without the confirmation, stores the token and goes to Home", async () => {
    registerMock.mockResolvedValue({ access_token: "token-1", token_type: "bearer" });
    renderPage();

    await fillAndSubmit({ name: "  Ravi ", email: " ravi@example.com " });

    expect(await screen.findByText("Home screen")).toBeInTheDocument();
    expect(registerMock).toHaveBeenCalledWith({ name: "Ravi", email: "ravi@example.com", password: "secret123" });
    expect(tokenStorage.getAccessToken()).toBe("token-1");
  });

  it("shows a registered email as an error on the email field", async () => {
    registerMock.mockRejectedValue(httpError(409));
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByText("An account with this email already exists")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it.each([
    ["rate limited", httpError(429), "Too many attempts"],
    ["a server error", httpError(500), "Something went wrong"],
    ["no connection", networkError(), "We couldn't reach the server"],
  ])("explains %s", async (_label, error, message) => {
    registerMock.mockRejectedValue(error);
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});
