import { useState } from "react";
import { cx } from "./cx";

export interface CoinAvatarProps {
  ticker: string;
  imageUrl: string;
  size?: number;
  className?: string;
}

/** The coin's image from Pyre, or its first letters on the raised surface when there is none. */
export function CoinAvatar({ ticker, imageUrl, size = 28, className }: CoinAvatarProps) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) };
  if (imageUrl !== "" && !broken) {
    return (
      <img
        alt=""
        className={cx("shrink-0 rounded-full border border-border bg-surface-raised object-cover", className)}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        src={imageUrl}
        style={style}
        width={size}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised font-mono text-ink-muted", className)}
      style={style}
    >
      {ticker.slice(0, 2)}
    </span>
  );
}
