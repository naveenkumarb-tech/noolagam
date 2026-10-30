import { ChevronDown } from "lucide-react";

type ChipSelectProps = {
  className?: string;
  label: string;
  value: string;
  isActive: boolean;
  disabled?: boolean;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

export function ChipSelect({ className = "", label, value, isActive, disabled, options, onChange }: ChipSelectProps) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`h-11 w-full cursor-pointer appearance-none truncate rounded-full border pr-7 pl-3 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${
          isActive ? "border-primary bg-reading-bg text-reading" : "border-input-border bg-surface text-text"
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={16}
        className={`pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 ${isActive ? "text-reading" : "text-text"}`}
      />
    </label>
  );
}
