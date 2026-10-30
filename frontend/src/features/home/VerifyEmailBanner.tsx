import { useMutation } from "@tanstack/react-query";

import { resendVerification } from "../../api/auth";
import { apiErrorMessage } from "../../api/errors";
import { useCurrentUser } from "../auth/useCurrentUser";

export function VerifyEmailBanner() {
  const { data: user } = useCurrentUser();
  const resend = useMutation({ mutationFn: resendVerification });

  if (!user || user.is_verified) {
    return null;
  }

  let message = `Please verify your email. We sent a link to ${user.email}.`;
  if (resend.isSuccess) message = `Check your inbox. We sent a new link to ${user.email}.`;
  if (resend.isError) message = apiErrorMessage(resend.error);

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[14px] bg-gifted-bg px-4 py-2">
      <p className="m-0 min-w-0 flex-1 basis-52 text-sm leading-normal text-gifted">{message}</p>
      {!resend.isSuccess && (
        <button
          type="button"
          disabled={resend.isPending}
          onClick={() => resend.mutate(user.email)}
          className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-gifted underline disabled:opacity-70"
        >
          {resend.isPending ? "Sending…" : "Resend"}
        </button>
      )}
    </div>
  );
}
