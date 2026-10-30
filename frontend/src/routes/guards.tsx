import { LoaderCircle } from "lucide-react";
import { Navigate, Outlet } from "react-router";

import { useAuthStatus } from "../features/auth/AuthProvider";

function FullPageLoader() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center text-primary">
      <LoaderCircle aria-hidden="true" size={32} className="animate-spin" />
    </div>
  );
}

export function ProtectedRoute() {
  const status = useAuthStatus();
  if (status === "loading") return <FullPageLoader />;
  return status === "authenticated" ? <Outlet /> : <Navigate to="/login" replace />;
}

export function GuestRoute() {
  const status = useAuthStatus();
  if (status === "loading") return <FullPageLoader />;
  return status === "anonymous" ? <Outlet /> : <Navigate to="/" replace />;
}
