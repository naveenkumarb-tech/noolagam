import { ChevronLeft } from "lucide-react";

type BackButtonProps = {
  label: string;
  onClick: () => void;
};

export function BackButton({ label, onClick }: BackButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-surface text-text shadow-card"
    >
      <ChevronLeft aria-hidden="true" size={20} />
    </button>
  );
}
