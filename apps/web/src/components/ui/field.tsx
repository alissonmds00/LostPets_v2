import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

const fieldControlClasses =
  "w-full rounded-lg border bg-bg px-3.5 h-11 text-base text-ink placeholder:text-muted " +
  "transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary";

type FieldWrapperProps = {
  label: string;
  error?: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
};

function FieldWrapper({ label, error, hint, htmlFor, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <FieldWrapper label={label} error={error} hint={hint} htmlFor={inputId}>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            fieldControlClasses,
            error ? "border-danger" : "border-border",
            className,
          )}
          {...props}
        />
      </FieldWrapper>
    );
  },
);
Input.displayName = "Input";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <FieldWrapper label={label} error={error} hint={hint} htmlFor={inputId}>
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            fieldControlClasses,
            "h-auto min-h-28 py-2.5 resize-y",
            error ? "border-danger" : "border-border",
            className,
          )}
          {...props}
        />
      </FieldWrapper>
    );
  },
);
Textarea.displayName = "Textarea";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, id, className, children, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <FieldWrapper label={label} error={error} hint={hint} htmlFor={inputId}>
        <select
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            fieldControlClasses,
            error ? "border-danger" : "border-border",
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </FieldWrapper>
    );
  },
);
Select.displayName = "Select";
