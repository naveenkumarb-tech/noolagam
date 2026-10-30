import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { resetPassword } from "../../api/auth";
import { apiErrorMessage } from "../../api/errors";
import { tokenStorage } from "../../api/tokenStorage";
import { Button } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { TextField } from "../../components/TextField";
import type { LoginLocationState } from "../../pages/LoginPage";
import { resetPasswordSchema, type ResetPasswordFormValues } from "./authSchemas";

type ResetPasswordFormProps = {
  token: string | null;
};

const CARD_CLASS = "flex flex-col gap-4 rounded-[20px] bg-surface p-[22px] shadow-card";

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLinkInvalid, setIsLinkInvalid] = useState(token === null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async ({ password }: ResetPasswordFormValues) => {
    setSubmitError(null);
    try {
      await resetPassword(token ?? "", password);
      // The reset ended every session, including one open in this browser.
      await tokenStorage.clearSession();
      const state: LoginLocationState = {
        successMessage: "Your password has been updated. Log in with your new password.",
      };
      navigate("/login", { replace: true, state });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 400) {
        setIsLinkInvalid(true);
        return;
      }
      setSubmitError(apiErrorMessage(error));
    }
  };

  if (isLinkInvalid) {
    return (
      <div className={CARD_CLASS}>
        <FormError message="This reset link has expired or has already been used." />
        <Link
          to="/forgot-password"
          className="flex min-h-11 items-center justify-center text-[15px] font-bold no-underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className={CARD_CLASS}>
      {submitError && <FormError message={submitError} />}
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={errors.password?.message}
        {...register("password", { deps: ["confirmPassword"] })}
      />
      <TextField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        placeholder="Type it again"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <ul className="m-0 list-disc pl-[18px] text-[13px] leading-[1.7] text-text-secondary">
        <li>At least 8 characters</li>
      </ul>
      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
