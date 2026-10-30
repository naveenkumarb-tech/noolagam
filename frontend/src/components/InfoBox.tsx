import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type InfoBoxProps = {
  icon: LucideIcon;
  children: ReactNode;
};

export function InfoBox({ icon: Icon, children }: InfoBoxProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-reading-bg p-4">
      <Icon aria-hidden="true" size={22} className="mt-px flex-none text-reading" />
      <p className="m-0 text-sm leading-normal text-info-text">{children}</p>
    </div>
  );
}
