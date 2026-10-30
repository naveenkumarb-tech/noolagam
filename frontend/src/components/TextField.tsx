import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  labelAction?: ReactNode;
  /** Shown beside the input, such as a button that acts on its value. */
  trailing?: ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, labelAction, trailing, ...props },
  ref,
) {
  const inputId = useId();
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={inputId} className="text-sm font-semibold">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="flex gap-2">
        <input
          {...props}
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`h-12 w-full min-w-0 rounded-xl border bg-surface px-3.5 text-[15px] text-text placeholder:text-text-secondary focus:border-primary focus:outline-2 focus:-outline-offset-1 focus:outline-primary ${
            error ? "border-danger" : "border-input-border"
          }`}
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} className="m-0 text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
