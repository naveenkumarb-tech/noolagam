import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

const VARIANT_CLASSES = {
  primary: "border-0 bg-primary text-white hover:bg-primary-hover",
  outline: "border border-input-border bg-surface text-text hover:bg-background",
  dark: "border-0 bg-text text-white hover:bg-text-tertiary",
  danger: "border-0 bg-danger text-white hover:bg-danger/90",
};

const SIZE_CLASSES = {
  lg: "h-[50px] text-base",
  md: "h-11 text-sm",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
};

export function Button({
  children,
  isLoading = false,
  variant = "primary",
  size = "lg",
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-70 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {isLoading && <LoaderCircle aria-hidden="true" size={20} className="animate-spin" />}
      {children}
    </button>
  );
}
