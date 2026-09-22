import { cx } from "./cx";

/** Shimmering placeholder block on the raised surface. Size it with width/height utilities. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("skeleton", className)} />;
}

/** A gallery card's shape while the list loads. */
export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="size-16 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}
