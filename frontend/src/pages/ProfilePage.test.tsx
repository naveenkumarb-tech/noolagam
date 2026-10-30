import { screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logout, resendVerification } from "../api/auth";
import { tokenStorage } from "../api/tokenStorage";
import { changePassword, getCurrentUser, updateProfile } from "../api/users";
import { httpError, networkError } from "../test/httpError";
import { renderWithProviders, SAMPLE_USER } from "../test/renderWithProviders";
import { ProfilePage } from "./ProfilePage";

vi.mock("../api/auth", () => ({ logout: vi.fn(), resendVerification: vi.fn() }));
vi.mock("../api/users", () => ({ changePassword: vi.fn(), getCurrentUser: vi.fn(), updateProfile: vi.fn() }));

const CURRENT = "current-password";
const NEW = "brand-new-password";

function apiError(status: number, code: string, message: string) {
  const error = httpError(status, message);
  error.response!.data.error.code = code;
  return error;
}

async function openDialog(user: UserEvent) {
  await user.click(await screen.findByRole("button", { name: "Change password" }));
}

async function fillAndSubmit(user: UserEvent, current = CURRENT, password = NEW, confirm = password) {
  if (current) await user.type(screen.getByLabelText("Current password"), current);
  if (password) await user.type(screen.getByLabelText("New password"), password);
  if (confirm) await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: "Update password" }));
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(SAMPLE_USER);
    tokenStorage.setAccessToken("token");
  });

  it("shows the account details", async () => {
    renderWithProviders(<ProfilePage />);

    expect(await screen.findByLabelText("Name")).toHaveValue("Ravi");
    expect(screen.getByText("ravi@example.com")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend email" })).not.toBeInTheDocument();
  });

  it("explains when the profile cannot be loaded", async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(networkError());
    const user = userEvent.setup();
    renderWithProviders(<ProfilePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText("Name")).toHaveValue("Ravi");
  });

  describe("name", () => {
    it("has nothing to save until the name changes", async () => {
      renderWithProviders(<ProfilePage />);

      await screen.findByLabelText("Name");
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("saves a new name and updates the rest of the app", async () => {
      vi.mocked(updateProfile).mockResolvedValue({ ...SAMPLE_USER, name: "Ravi Kumar" });
      const user = userEvent.setup();
      const queryClient = renderWithProviders(<ProfilePage />);

      const name = await screen.findByLabelText("Name");
      await user.clear(name);
      await user.type(name, "  Ravi Kumar ");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("Your name has been updated.")).toBeInTheDocument();
      expect(vi.mocked(updateProfile).mock.calls[0][0]).toBe("Ravi Kumar");
      expect(queryClient.getQueryData(["current-user"])).toMatchObject({ name: "Ravi Kumar" });
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it.each([
      ["", "Enter your name"],
      ["x".repeat(101), "Use at most 100 characters"],
    ])("rejects a name of '%s'", async (value, message) => {
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      const name = await screen.findByLabelText("Name");
      await user.clear(name);
      if (value) await user.type(name, value);
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(updateProfile).not.toHaveBeenCalled();
    });

    it("keeps the typed name and explains when saving fails", async () => {
      vi.mocked(updateProfile).mockRejectedValue(networkError());
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      const name = await screen.findByLabelText("Name");
      await user.type(name, " Kumar");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
      expect(name).toHaveValue("Ravi Kumar");
    });
  });

  describe("email verification", () => {
    it("offers to resend for an unverified account", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...SAMPLE_USER, is_verified: false });
      vi.mocked(resendVerification).mockResolvedValue();
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      expect(await screen.findByText("Not verified")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Resend email" }));

      expect(await screen.findByText(/a new link is on its way/)).toBeInTheDocument();
      expect(vi.mocked(resendVerification).mock.calls[0][0]).toBe(SAMPLE_USER.email);
    });
  });

  describe("change password", () => {
    it("changes the password, keeps this session and confirms", async () => {
      vi.mocked(changePassword).mockResolvedValue({ access_token: "new-token" });
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      await openDialog(user);
      await fillAndSubmit(user);

      expect(await screen.findByText(/Your password has been changed/)).toBeInTheDocument();
      expect(changePassword).toHaveBeenCalledWith(CURRENT, NEW);
      expect(tokenStorage.getAccessToken()).toBe("new-token");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("validates before calling the API", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      await openDialog(user);
      await fillAndSubmit(user, "", "", "");

      expect(await screen.findByText("Enter your current password")).toBeInTheDocument();
      expect(screen.getByText("Use at least 8 characters")).toBeInTheDocument();
      expect(screen.getByText("Type your password again")).toBeInTheDocument();
      expect(changePassword).not.toHaveBeenCalled();
    });

    it("requires the new passwords to match", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      await openDialog(user);
      await fillAndSubmit(user, CURRENT, NEW, "something-else");

      expect(await screen.findByText("The passwords don't match")).toBeInTheDocument();
      expect(changePassword).not.toHaveBeenCalled();
    });

    it("shows a wrong current password on that field, and keeps the session", async () => {
      vi.mocked(changePassword).mockRejectedValue(
        apiError(400, "INVALID_CURRENT_PASSWORD", "Your current password is not correct"),
      );
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      await openDialog(user);
      await fillAndSubmit(user);

      expect(await screen.findByText("Your current password is not correct")).toBeInTheDocument();
      expect(screen.getByLabelText("Current password")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Current password")).toHaveFocus();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(tokenStorage.getAccessToken()).toBe("token");
    });

    it("shows a reused password on the new password field", async () => {
      vi.mocked(changePassword).mockRejectedValue(
        apiError(422, "NEW_PASSWORD_SAME", "Choose a password different from your current one"),
      );
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      await openDialog(user);
      await fillAndSubmit(user);

      expect(await screen.findByText("Choose a password different from your current one")).toBeInTheDocument();
      expect(screen.getByLabelText("New password")).toHaveAttribute("aria-invalid", "true");
    });

    it.each([
      [httpError(429), "Too many attempts"],
      [networkError(), "We couldn't reach the server"],
    ])("stays open and explains other failures", async (error, message) => {
      vi.mocked(changePassword).mockRejectedValue(error);
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      await openDialog(user);
      await fillAndSubmit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("does nothing on Cancel", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      await openDialog(user);
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(changePassword).not.toHaveBeenCalled();
    });
  });

  describe("log out", () => {
    it("logs out", async () => {
      vi.mocked(logout).mockResolvedValue();
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      await user.click(await screen.findByRole("button", { name: "Log out" }));

      await waitFor(() => expect(tokenStorage.getAccessToken()).toBeNull());
      expect(logout).toHaveBeenCalledTimes(1);
    });

    it("ends the session on this device even if the server cannot be reached", async () => {
      vi.mocked(logout).mockRejectedValue(networkError());
      const user = userEvent.setup();
      renderWithProviders(<ProfilePage />);

      await user.click(await screen.findByRole("button", { name: "Log out" }));

      await waitFor(() => expect(tokenStorage.getAccessToken()).toBeNull());
    });
  });
});
