import { Lock } from "lucide-react";
import { useSearchParams } from "react-router";

import { ResetPasswordForm } from "../features/auth/ResetPasswordForm";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center gap-6 px-7 py-8">
      <div className="flex flex-col gap-3.5">
        <div
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-2xl bg-primary text-white"
        >
          <Lock size={28} />
        </div>
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.5px]">Set a new password</h1>
        <p className="m-0 text-[15px] leading-normal text-text-secondary">
          Choose a new password for your Noolagam account. You'll be logged out on your other devices.
        </p>
      </div>

      <ResetPasswordForm token={searchParams.get("token")} />
    </main>
  );
}
