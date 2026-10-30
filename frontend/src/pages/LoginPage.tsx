import { CircleCheck } from "lucide-react";
import { Link, useLocation } from "react-router";

import { AppIcon } from "../components/AppIcon";
import { InfoBox } from "../components/InfoBox";
import { LoginForm } from "../features/auth/LoginForm";

export type LoginLocationState = {
  successMessage?: string;
};

export function LoginPage() {
  const { state } = useLocation();
  const successMessage = (state as LoginLocationState | null)?.successMessage;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center gap-9 px-7 py-8">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <AppIcon />
        <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.5px]">Noolagam</h1>
        <p className="m-0 text-[15px] leading-normal text-text-secondary">
          Track the books you own, who gave them, and what you are reading.
        </p>
      </div>

      {successMessage && (
        <div role="status">
          <InfoBox icon={CircleCheck}>{successMessage}</InfoBox>
        </div>
      )}

      <LoginForm />

      <p className="m-0 text-center text-[15px] text-text-secondary">
        New to Noolagam?{" "}
        <Link
          to="/signup"
          className="relative font-bold no-underline after:absolute after:inset-x-0 after:-inset-y-3"
        >
          Create an account
        </Link>
      </p>
    </main>
  );
}
