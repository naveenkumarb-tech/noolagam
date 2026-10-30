import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetPassword } from "../api/auth";
import { tokenStorage } from "../api/tokenStorage";
import { httpError, networkError } from "../test/httpError";
import { ResetPasswordPage } from "./ResetPasswordPage";

vi.mock("../api/auth", () => ({ resetPassword: vi.fn() }));

const resetPasswordMock = vi.mocked(resetPassword);

function LoginStub() {
  const { state } = useLocation();
  return <p>Login: {state?.successMessage}</p>;
}

function renderPage(url = "/reset-password?token=abc123") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginStub />} />
        <Route path="/forgot-password" element={<p>Forgot screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submit(password: string, confirm = password) {
  const user = userEvent.setup();
  if (password) await user.type(screen.getByLabelText("New password"), password);
  if (confirm) await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: "Update password" }));
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
  });

  it("validates the new password without calling the API", async () => {
    renderPage();

    await submit("short12");

    expect(await screen.findByText("Use at least 8 characters")).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("rejects passwords that don't match", async () => {
    renderPage();

    await submit("new-password-1", "new-password-2");

    expect(await screen.findByText("The passwords don't match")).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("sends the token from the link and goes to Login with a success message", async () => {
    resetPasswordMock.mockResolvedValue();
    renderPage();

    await submit("new-password-1");

    expect(await screen.findByText(/Your password has been updated/)).toBeInTheDocument();
    expect(resetPasswordMock).toHaveBeenCalledWith("abc123", "new-password-1");
  });

  it("ends a session open in this browser, so Login is not skipped", async () => {
    resetPasswordMock.mockResolvedValue();
    tokenStorage.setAccessToken("old-session");
    renderPage();

    await submit("new-password-1");

    await screen.findByText(/Your password has been updated/);
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("offers a new link when the link has expired or was already used", async () => {
    resetPasswordMock.mockRejectedValue(httpError(400));
    renderPage();

    await submit("new-password-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("expired or has already been used");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("link", { name: "Request a new link" }));
    expect(await screen.findByText("Forgot screen")).toBeInTheDocument();
  });

  it("offers a new link when the URL has no token", () => {
    renderPage("/reset-password");

    expect(screen.getByRole("alert")).toHaveTextContent("expired or has already been used");
    expect(screen.getByRole("link", { name: "Request a new link" })).toBeInTheDocument();
  });

  it("keeps the form when the server cannot be reached", async () => {
    resetPasswordMock.mockRejectedValue(networkError());
    renderPage();

    await submit("new-password-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });
});
