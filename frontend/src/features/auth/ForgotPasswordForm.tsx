import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { forgotPassword } from "../../api/auth";
import { apiErrorMessage } from "../../api/errors";
import { Button } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { InfoBox } from "../../components/InfoBox";
import { TextField } from "../../components/TextField";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "./authSchemas";

export function ForgotPasswordForm() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async ({ email }: ForgotPasswordFormValues) => {
    setSubmitError(null);
    setIsSent(false);
    try {
      await forgotPassword(email);
      setIsSent(true);
    } catch (error) {
      setSubmitError(apiErrorMessage(error));
    }
  };

  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4 rounded-[20px] bg-surface p-[22px] shadow-card"
      >
        {submitError && <FormError message={submitError} />}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      {/* Always mounted, so that screen readers announce the message when it appears. */}
      <div role="status">
        {isSent && (
          <InfoBox icon={Mail}>
            <strong>Check your inbox.</strong> If an account exists for this email, a reset link is on its way. The
            link works once and expires in 30 minutes.
          </InfoBox>
        )}
      </div>
    </>
  );
}
