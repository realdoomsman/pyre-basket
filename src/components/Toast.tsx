import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
}

interface ToastApi {
  toast: (text: string, tone?: Toast["tone"]) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast() needs a <ToastProvider>");
  return api;
}

const TTL_MS = 3200;

/** Bottom-centre notifications. Errors stay twice as long and are announced assertively. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (text: string, tone: Toast["tone"] = "info") => {
      const id = next.current++;
      setItems((list) => [...list.slice(-2), { id, text, tone }]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), tone === "error" ? TTL_MS * 2 : TTL_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "rise pointer-events-auto flex max-w-md items-center gap-3 rounded-card border bg-surface px-4 py-2.5 text-sm shadow-lg",
              t.tone === "error" ? "border-danger text-danger" : "border-border-strong text-ink",
            )}
            role={t.tone === "error" ? "alert" : "status"}
          >
            <span>{t.text}</span>
            <button aria-label="Dismiss" className="text-ink-faint hover:text-ink" onClick={() => dismiss(t.id)} type="button">
              Close
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
