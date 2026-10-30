import { ChevronLeft } from "lucide-react";
import { Link } from "react-router";

type BackLinkProps = {
  to: string;
  label: string;
};

export function BackLink({ to, label }: BackLinkProps) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-full bg-surface text-text hover:text-text"
    >
      <ChevronLeft aria-hidden="true" size={20} />
    </Link>
  );
}
