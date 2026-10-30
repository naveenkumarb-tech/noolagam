import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, ...props },
  ref,
) {
  const inputId = useId();
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        {...props}
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full resize-y rounded-xl border bg-surface px-3.5 py-2.5 text-[15px] leading-normal text-text placeholder:text-text-secondary focus:border-primary focus:outline-2 focus:-outline-offset-1 focus:outline-primary ${
          error ? "border-danger" : "border-input-border"
        }`}
      />
      {error && (
        <p id={errorId} className="m-0 text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
