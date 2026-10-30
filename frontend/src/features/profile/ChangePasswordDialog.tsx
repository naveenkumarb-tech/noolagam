import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useForm } from "react-hook-form";

import type { ApiErrorBody } from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { tokenStorage } from "../../api/tokenStorage";
import { changePassword } from "../../api/users";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { FormError } from "../../components/FormError";
import { TextField } from "../../components/TextField";
import { changePasswordSchema, type ChangePasswordFormValues } from "../auth/authSchemas";

type ChangePasswordDialogProps = {
  onChanged: () => void;
  onClose: () => void;
};

function errorCode(error: unknown): string | undefined {
  return isAxiosError<ApiErrorBody>(error) ? error.response?.data?.error?.code : undefined;
}

export function ChangePasswordDialog({ onChanged, onClose }: ChangePasswordDialogProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema) });

  const change = useMutation({
    mutationFn: ({ currentPassword, password }: ChangePasswordFormValues) =>
      changePassword(currentPassword, password),
    onSuccess: async (tokens) => {
      // The old tokens stopped working with this change, so the new ones replace them immediately.
      await tokenStorage.saveSession(tokens);
      onChanged();
    },
    onError: (error) => {
      const code = errorCode(error);
      if (code === "INVALID_CURRENT_PASSWORD") {
        setError("currentPassword", { message: apiErrorMessage(error) }, { shouldFocus: true });
      } else if (code === "NEW_PASSWORD_SAME") {
        setError("password", { message: apiErrorMessage(error) }, { shouldFocus: true });
      }
    },
  });

  // Errors shown on a field don't also need the message at the top.
  const code = errorCode(change.error);
  const showFormError = change.isError && code !== "INVALID_CURRENT_PASSWORD" && code !== "NEW_PASSWORD_SAME";

  return (
    <Dialog title="Change password" onClose={onClose}>
      <form noValidate className="flex flex-col gap-3.5" onSubmit={handleSubmit((values) => change.mutate(values))}>
        <p className="m-0 text-sm leading-normal text-text-secondary">
          You'll stay logged in here and be logged out on your other devices.
        </p>
        {showFormError && <FormError message={apiErrorMessage(change.error)} />}
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register("currentPassword")}
        />
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
        <div className="grid grid-cols-2 gap-2.5">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="md" isLoading={change.isPending}>
            Update password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
