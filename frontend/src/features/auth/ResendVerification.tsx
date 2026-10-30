import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { resendVerification } from "../../api/auth";
import { apiErrorMessage } from "../../api/errors";
import { Button } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { TextField } from "../../components/TextField";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "./authSchemas";

type ResendVerificationProps = {
  /** Known when logged in; otherwise the form asks for it. */
  email?: string;
  variant?: "primary" | "outline";
};

export function ResendVerification({ email, variant = "primary" }: ResendVerificationProps) {
  const resend = useMutation({ mutationFn: resendVerification });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  if (resend.isSuccess) {
    return (
      <p role="status" className="m-0 text-center text-sm font-semibold text-reading">
        Check your inbox. If this email needs verifying, a new link is on its way.
      </p>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={
        email
          ? (event) => {
              event.preventDefault();
              resend.mutate(email);
            }
          : handleSubmit((values) => resend.mutate(values.email))
      }
    >
      {resend.isError && <FormError message={apiErrorMessage(resend.error)} />}
      {!email && (
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
      )}
      <Button type="submit" variant={variant} isLoading={resend.isPending}>
        Resend email
      </Button>
    </form>
  );
}
