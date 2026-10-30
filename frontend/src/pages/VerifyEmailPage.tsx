import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { CircleCheck, LoaderCircle, MailX } from "lucide-react";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";

import { verifyEmail } from "../api/auth";
import { apiErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { FormError } from "../components/FormError";
import { useAuthStatus } from "../features/auth/AuthProvider";
import { ResendVerification } from "../features/auth/ResendVerification";
import { CURRENT_USER_KEY, useCurrentUser } from "../features/auth/useCurrentUser";

const CARD_CLASS = "flex flex-col gap-4 rounded-[20px] bg-surface p-[22px] shadow-card";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const queryClient = useQueryClient();
  const status = useAuthStatus();
  const { data: user } = useCurrentUser();

  // A query rather than an effect: links work once, and React's strict mode runs effects twice.
  const verification = useQuery({
    queryKey: ["verify-email", token],
    queryFn: async () => {
      await verifyEmail(token ?? "");
      return true;
    },
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (verification.isSuccess) {
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
    }
  }, [verification.isSuccess, queryClient]);

  const isLinkInvalid =
    token === null || (isAxiosError(verification.error) && verification.error.response?.status === 400);

  let icon = <LoaderCircle aria-hidden="true" size={28} className="animate-spin" />;
  let title = "Verifying your email…";
  let body = null;

  if (verification.isSuccess) {
    icon = <CircleCheck aria-hidden="true" size={28} />;
    title = "Your email is verified";
    body = (
      <div className={CARD_CLASS}>
        <p className="m-0 text-[15px] leading-normal text-text-secondary">Thanks for confirming your address.</p>
        <Link
          to="/"
          className="flex h-[50px] items-center justify-center rounded-xl bg-primary text-base font-bold text-white no-underline hover:bg-primary-hover hover:text-white"
        >
          {status === "authenticated" ? "Go to your bookshelf" : "Log in"}
        </Link>
      </div>
    );
  } else if (isLinkInvalid) {
    icon = <MailX aria-hidden="true" size={28} />;
    title = "This link has expired";
    body = (
      <div className={CARD_CLASS}>
        <FormError message="This verification link has expired or has already been used." />
        <ResendVerification email={user?.email} />
      </div>
    );
  } else if (verification.isError) {
    icon = <MailX aria-hidden="true" size={28} />;
    title = "We couldn't verify your email";
    body = (
      <div className={CARD_CLASS}>
        <FormError message={apiErrorMessage(verification.error)} />
        <Button isLoading={verification.isFetching} onClick={() => verification.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center gap-6 px-7 py-8">
      <div className="flex flex-col gap-3.5">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-white">{icon}</div>
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.5px]">{title}</h1>
      </div>
      {body}
    </main>
  );
}
