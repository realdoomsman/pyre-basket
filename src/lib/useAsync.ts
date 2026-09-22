import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { errorMessage } from "./format";

export type AsyncState<T> =
  | { status: "loading"; data: T | null }
  | { status: "ready"; data: T }
  | { status: "error"; data: T | null; error: string };

/**
 * Runs `load` whenever `deps` change and exposes loading / ready / error with a retry. Stale
 * responses (an earlier call resolving after a later one) are dropped. Previous data is kept
 * during reloads so lists do not flash empty while a filter changes.
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> & { retry: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const id = ++seq.current;
    setState((prev) => ({ status: "loading", data: prev.data }));
    loadRef
      .current()
      .then((data) => {
        if (seq.current === id) setState({ status: "ready", data });
      })
      .catch((cause: unknown) => {
        if (seq.current === id) setState((prev) => ({ status: "error", data: prev.data, error: errorMessage(cause) }));
      });
    // `load` is read through a ref so callers pass the values it closes over as deps.
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
