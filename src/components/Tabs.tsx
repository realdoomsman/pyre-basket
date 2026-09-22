import { cx } from "./cx";

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

export interface TabsProps<T extends string> {
  label: string;
  value: T;
  options: TabOption<T>[];
  onChange: (value: T) => void;
}

/** Segmented control on the surface colour. Arrow keys move between options like a radio group. */
export function Tabs<T extends string>({ label, value, options, onChange }: TabsProps<T>) {
  return (
    <div aria-label={label} className="inline-flex h-10 items-center gap-0.5 rounded-card border border-border bg-surface p-0.5" role="radiogroup">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            aria-checked={active}
            className={cx(
              "h-full rounded-[6px] px-3 text-sm font-medium transition-colors",
              active ? "bg-surface-raised text-ink" : "text-ink-muted hover:text-ink",
            )}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const i = options.findIndex((o) => o.value === value);
              const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
              if (next) onChange(next.value);
            }}
            role="radio"
            tabIndex={active ? 0 : -1}
            type="button"
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
