import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import type { AuthStatus } from "../features/auth/AuthProvider";
import { renderWithProviders } from "../test/renderWithProviders";
import { GuestRoute, ProtectedRoute } from "./guards";

function renderRoutes(route: string, status: AuthStatus) {
  renderWithProviders(
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<p>Home screen</p>} />
      </Route>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<p>Login screen</p>} />
      </Route>
    </Routes>,
    { route, status },
  );
}

describe("route guards", () => {
  it("sends logged-out users to Login", () => {
    renderRoutes("/", "anonymous");

    expect(screen.getByText("Login screen")).toBeInTheDocument();
  });

  it("sends logged-in users away from Login", () => {
    renderRoutes("/login", "authenticated");

    expect(screen.getByText("Home screen")).toBeInTheDocument();
  });

  it.each(["/", "/login"])("waits while the session is being restored on %s", (route) => {
    renderRoutes(route, "loading");

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText("Home screen")).not.toBeInTheDocument();
    expect(screen.queryByText("Login screen")).not.toBeInTheDocument();
  });

  it("shows protected pages to logged-in users", () => {
    renderRoutes("/", "authenticated");

    expect(screen.getByText("Home screen")).toBeInTheDocument();
  });
});
