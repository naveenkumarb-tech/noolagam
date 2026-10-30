import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { apiErrorMessage } from "../../api/errors";
import { updateProfile, type User } from "../../api/users";
import { Button } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { TextField } from "../../components/TextField";
import { profileSchema, type ProfileFormValues } from "../auth/authSchemas";
import { CURRENT_USER_KEY } from "../auth/useCurrentUser";

export function ProfileForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema), defaultValues: { name: user.name } });

  const save = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      // Also updates the avatar and the sidebar straight away.
      queryClient.setQueryData(CURRENT_USER_KEY, updated);
      reset({ name: updated.name });
    },
  });

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={handleSubmit(({ name }) => save.mutate(name))}>
      {save.isError && <FormError message={apiErrorMessage(save.error)} />}
      <TextField
        label="Name"
        type="text"
        autoComplete="name"
        error={errors.name?.message}
        trailing={
          <Button
            type="submit"
            variant="outline"
            size="md"
            className="!h-12 !w-auto flex-none px-4"
            disabled={!isDirty}
            isLoading={save.isPending}
          >
            Save
          </Button>
        }
        {...register("name", { onChange: () => save.reset() })}
      />
      <p role="status" className="m-0 text-[13px] font-semibold text-reading empty:hidden">
        {save.isSuccess && "Your name has been updated."}
      </p>
    </form>
  );
}
