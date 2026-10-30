import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resendVerification, verifyEmail } from "../api/auth";
import { getCurrentUser } from "../api/users";
import { httpError, networkError } from "../test/httpError";
import { renderWithProviders, SAMPLE_USER } from "../test/renderWithProviders";
import { VerifyEmailPage } from "./VerifyEmailPage";

vi.mock("../api/auth", () => ({ verifyEmail: vi.fn(), resendVerification: vi.fn() }));
vi.mock("../api/users", () => ({ getCurrentUser: vi.fn() }));

const LINK = "/verify-email?token=abc123";

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(SAMPLE_USER);
  });

  it("verifies the token from the link once", async () => {
    vi.mocked(verifyEmail).mockResolvedValue();
    renderWithProviders(<VerifyEmailPage />, { route: LINK, status: "anonymous" });

    expect(await screen.findByText("Your email is verified")).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(verifyEmail).toHaveBeenCalledWith("abc123");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/");
  });

  it("refreshes the profile so the banner disappears", async () => {
    vi.mocked(verifyEmail).mockResolvedValue();
    const queryClient = renderWithProviders(<VerifyEmailPage />, { route: LINK });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    expect(await screen.findByRole("link", { name: "Go to your bookshelf" })).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["current-user"] });
  });

  it("offers to resend to the logged-in user when the link has expired", async () => {
    vi.mocked(verifyEmail).mockRejectedValue(httpError(400));
    vi.mocked(resendVerification).mockResolvedValue();
    const user = userEvent.setup();
    renderWithProviders(<VerifyEmailPage />, { route: LINK });

    expect(await screen.findByText("This link has expired")).toBeInTheDocument();
    await screen.findByRole("button", { name: "Resend email" });
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resend email" }));

    expect(await screen.findByText(/a new link is on its way/)).toBeInTheDocument();
    expect(vi.mocked(resendVerification).mock.calls[0][0]).toBe(SAMPLE_USER.email);
  });

  it("asks for the email when the link has expired and nobody is logged in", async () => {
    vi.mocked(verifyEmail).mockRejectedValue(httpError(400));
    vi.mocked(resendVerification).mockResolvedValue();
    const user = userEvent.setup();
    renderWithProviders(<VerifyEmailPage />, { route: LINK, status: "anonymous" });

    await screen.findByText("This link has expired");
    await user.type(screen.getByLabelText("Email"), "ravi@example.com");
    await user.click(screen.getByRole("button", { name: "Resend email" }));

    expect(await screen.findByText(/a new link is on its way/)).toBeInTheDocument();
    expect(vi.mocked(resendVerification).mock.calls[0][0]).toBe("ravi@example.com");
  });

  it("treats a missing token as an expired link without calling the API", async () => {
    renderWithProviders(<VerifyEmailPage />, { route: "/verify-email", status: "anonymous" });

    expect(await screen.findByText("This link has expired")).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it("offers a retry when the server cannot be reached, which keeps the link usable", async () => {
    vi.mocked(verifyEmail).mockRejectedValueOnce(networkError()).mockResolvedValueOnce();
    const user = userEvent.setup();
    renderWithProviders(<VerifyEmailPage />, { route: LINK, status: "anonymous" });

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Your email is verified")).toBeInTheDocument();
  });
});
