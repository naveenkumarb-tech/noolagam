import { useMutation } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useState } from "react";

import { logout } from "../api/auth";
import { tokenStorage } from "../api/tokenStorage";
import { Button } from "../components/Button";
import { InfoBox } from "../components/InfoBox";
import { SectionError, SectionSkeleton } from "../components/SectionStates";
import { useCurrentUser } from "../features/auth/useCurrentUser";
import { ChangePasswordDialog } from "../features/profile/ChangePasswordDialog";
import { ProfileForm } from "../features/profile/ProfileForm";

export function ProfilePage() {
  const { data: user, isPending, isError, error, refetch } = useCurrentUser();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const signOut = useMutation({
    mutationFn: logout,
    // The session ends on this device even if the server could not be reached.
    onSettled: () => tokenStorage.setAccessToken(null),
  });

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px] lg:text-[30px]">Profile</h1>
      {isPending && <SectionSkeleton heightClass="h-64" />}
      {isError && <SectionError error={error} onRetry={refetch} />}
      {user && (
        <>
          <section className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-card">
            <ProfileForm user={user} />
            <div>
              <p className="m-0 text-sm font-semibold">Email</p>
              <p className="m-0 mt-0.5 text-[15px] break-words text-text-secondary">{user.email}</p>
            </div>
          </section>

          <div role="status" className="empty:hidden">
            {passwordChanged && (
              <InfoBox icon={CircleCheck}>
                Your password has been changed. You've been logged out on your other devices.
              </InfoBox>
            )}
          </div>

          <section className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
            <Button
              variant="outline"
              onClick={() => {
                setPasswordChanged(false);
                setIsChangingPassword(true);
              }}
            >
              Change password
            </Button>
            <Button variant="outline" isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
              Log out
            </Button>
          </section>

          {isChangingPassword && (
            <ChangePasswordDialog
              onChanged={() => {
                setIsChangingPassword(false);
                setPasswordChanged(true);
              }}
              onClose={() => setIsChangingPassword(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
