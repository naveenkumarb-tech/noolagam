import { Book } from "lucide-react";

export function AppIcon() {
  return (
    <div
      aria-hidden="true"
      className="flex size-[72px] items-center justify-center rounded-[20px] bg-primary text-white"
    >
      <Book size={36} strokeWidth={2} />
    </div>
  );
}
