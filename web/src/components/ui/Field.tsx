import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";

const labelClass =
  "block text-xs font-display font-medium uppercase tracking-wide text-fg-faint";

const controlBase =
  "w-full rounded-lg border bg-ink-800 px-3 py-2 text-sm text-fg placeholder-fg-faint " +
  "transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-signal-400/70 disabled:opacity-50 disabled:cursor-not-allowed";

function borderClass(hasError: boolean): string {
  return hasError
    ? "border-critical/60 focus-visible:ring-critical/60"
    : "border-line focus-visible:border-signal-400/60";
}

/** Shared label / hint / error scaffold around a control. */
function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-critical">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error
    ? `${fieldId}-error`
    : hint
      ? `${fieldId}-hint`
      : undefined;

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(controlBase, borderClass(Boolean(error)), className)}
        {...rest}
      />
    </FieldShell>
  );
});

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, error, className, id, ...rest }, ref) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const describedBy = error
      ? `${fieldId}-error`
      : hint
        ? `${fieldId}-hint`
        : undefined;

    return (
      <FieldShell id={fieldId} label={label} hint={hint} error={error}>
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            controlBase,
            "min-h-[6rem] resize-y",
            borderClass(Boolean(error)),
            className,
          )}
          {...rest}
        />
      </FieldShell>
    );
  },
);
