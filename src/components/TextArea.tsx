import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

/** Multi-line `Input`: same surface, border and focus ring. */
export function TextArea({ label, hint, error, className, id, ...rest }: TextAreaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const described = cx(hint !== undefined && hintId, error !== undefined && errorId) || undefined;

  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label className="text-sm text-ink-muted" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        aria-describedby={described}
        aria-invalid={error !== undefined || undefined}
        className={cx(
          "min-h-24 w-full resize-y rounded-card border bg-bg px-3 py-2 text-sm leading-relaxed text-ink outline-none transition-colors",
          "placeholder:text-ink-faint focus:border-violet disabled:cursor-not-allowed disabled:opacity-50",
          error !== undefined ? "border-danger" : "border-border hover:border-border-strong",
        )}
        id={inputId}
        {...rest}
      />
      {error !== undefined ? (
        <p className="text-sm text-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p className="text-sm text-ink-faint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
