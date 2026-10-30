import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { login } from "../../api/auth";
import { apiErrorMessage } from "../../api/errors";
import { tokenStorage } from "../../api/tokenStorage";
import { Button } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { TextField } from "../../components/TextField";
import { loginSchema, type LoginFormValues } from "./authSchemas";

export function LoginForm() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      const { access_token } = await login(values);
      tokenStorage.setAccessToken(access_token);
      navigate("/", { replace: true });
    } catch (error) {
      setSubmitError(apiErrorMessage(error, { 401: "That email and password don't match. Please try again." }));
    }
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-[18px] rounded-[20px] bg-surface p-6 shadow-card"
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
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        labelAction={
          // The pseudo-element extends the tap area to 44 px, stopping short of the inputs above and below.
          <Link
            to="/forgot-password"
            className="relative inline-block text-[13px] leading-5 font-bold no-underline after:absolute after:inset-x-0 after:-top-[18px] after:-bottom-1.5"
          >
            Forgot password?
          </Link>
        }
        {...register("password")}
      />
      <Button type="submit" isLoading={isSubmitting} className="mt-1">
        {isSubmitting ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
