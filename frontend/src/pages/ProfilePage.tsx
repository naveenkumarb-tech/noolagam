import { useMutation } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useState } from "react";

import { logout } from "../api/auth";
import { tokenStorage } from "../api/tokenStorage";
import { APP_DESCRIPTION, APP_VERSION, COPYRIGHT_NOTICE, DEVELOPER_EMAIL, DEVELOPER_NAME } from "../appInfo";
import { Button } from "../components/Button";
import { InfoBox } from "../components/InfoBox";
import { SectionError, SectionSkeleton } from "../components/SectionStates";
import { useCurrentUser } from "../features/auth/useCurrentUser";
import { ChangePasswordDialog } from "../features/profile/ChangePasswordDialog";
import { ProfileForm } from "../features/profile/ProfileForm";

// Too long for the narrowest phones, so it may only wrap before the @ rather than mid-word.
const [name, domain] = DEVELOPER_EMAIL.split("@");

export function ProfilePage() {
  const { data: user, isPending, isError, error, refetch } = useCurrentUser();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const signOut = useMutation({
    mutationFn: logout,
    // The session ends on this device even if the server could not be reached.
    onSettled: () => tokenStorage.clearSession(),
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

          <section className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
            <h2 className="m-0 text-base font-bold">About</h2>
            <p className="m-0 text-[15px] leading-normal text-text-secondary">{APP_DESCRIPTION}</p>
            <dl className="m-0 flex flex-col gap-2 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Version</dt>
                <dd className="m-0 font-semibold">{APP_VERSION}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Developed by</dt>
                <dd className="m-0 text-right font-semibold">{DEVELOPER_NAME}</dd>
              </div>
              {/* Lines up with the rows above. Only where the address doesn't fit does it move to its own line. */}
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <dt className="text-text-secondary">Contact</dt>
                <dd className="m-0 ml-auto min-w-0 text-right font-semibold">
                  {/* The pseudo-element makes the tap area 44 px tall without moving the rows above. */}
                  <a
                    href={`mailto:${DEVELOPER_EMAIL}`}
                    className="relative text-text no-underline hover:text-text hover:underline after:absolute after:inset-x-0 after:-inset-y-3"
                  >
                    {name}
                    <wbr />@{domain}
                  </a>
                </dd>
              </div>
            </dl>
            <p className="m-0 text-[13px] text-text-secondary">{COPYRIGHT_NOTICE}</p>
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
