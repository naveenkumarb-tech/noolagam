import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { register as registerAccount } from "../../api/auth";
import { apiErrorMessage } from "../../api/errors";
import { tokenStorage } from "../../api/tokenStorage";
import { Button } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { TextField } from "../../components/TextField";
import { signUpSchema, type SignUpFormValues } from "./authSchemas";

export function SignUpForm() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({ resolver: zodResolver(signUpSchema) });

  const onSubmit = async ({ name, email, password }: SignUpFormValues) => {
    setSubmitError(null);
    try {
      await tokenStorage.saveSession(await registerAccount({ name, email, password }));
      navigate("/", { replace: true });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setError("email", { message: "An account with this email already exists" }, { shouldFocus: true });
        return;
      }
      setSubmitError(apiErrorMessage(error));
    }
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-[20px] bg-surface p-[22px] shadow-card"
    >
      {submitError && <FormError message={submitError} />}
      <TextField
        label="Name"
        type="text"
        autoComplete="name"
        placeholder="Your name"
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={errors.password?.message}
        {...register("password", { deps: ["confirmPassword"] })}
      />
      <TextField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="Type it again"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" isLoading={isSubmitting} className="mt-1">
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
