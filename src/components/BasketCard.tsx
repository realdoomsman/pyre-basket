import type { ReactNode } from "react";
import { dataSource, type Coin } from "../lib/coins";
import { relativeDate, usdCompact } from "../lib/format";
import { detailHref, galleryHref } from "../lib/route";
import { totalMarketCap, weighted24h } from "../lib/stats";
import { heatByRank } from "../lib/weights";
import type { BasketCard } from "../types";
import { Chip } from "./Chip";
import { Delta } from "./Delta";
import { Donut } from "./Donut";
import { cx } from "./cx";

export interface BasketCardProps {
  card: BasketCard;
  /** Live coin data for the legs; missing entries render as unpriced. */
  bySlug: Record<string, Coin>;
  /** True while the coin data is still loading, so the numbers show as placeholders. */
  pricing: boolean;
  /** Row of buttons under the card body (My baskets). */
  actions?: ReactNode;
}

/** Gallery / My baskets card: title, blurb, mini donut, live 24h and mcap, legs by weight, tags. */
export function BasketCardView({ card, bySlug, pricing, actions }: BasketCardProps) {
  const colours = heatByRank(card.tokens.map((t) => t.weight));
  const shown = card.tokens.slice(0, 5);
  const more = card.tokens.length - shown.length;
  const change = weighted24h(card.tokens, bySlug);
  const mcap = totalMarketCap(card.tokens, bySlug);
  const priced = card.tokens.filter((t) => bySlug[t.slug] !== undefined).length;

  return (
    <li className="group relative flex flex-col gap-4 rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {card.auto ? <Chip>auto</Chip> : null}
            {card.featured ? <Chip tone="violet">featured</Chip> : null}
          </div>
          <h3 className="text-xl leading-tight text-ink">
            <a className="after:absolute after:inset-0 after:content-[''] hover:text-violet" href={detailHref(card.id)}>
              {card.title}
            </a>
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{card.blurb}</p>
        </div>
        <Donut size={64} slices={card.tokens} thickness={10} />
      </div>

      <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <dt className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">24h</dt>
          <dd className="text-base">{pricing ? <span className="skeleton inline-block h-5 w-14" /> : <Delta coverage={change.coverage} sinceLaunch={change.sinceLaunch >= 0.999} value={change.pct} />}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">combined mcap</dt>
          <dd className="font-mono text-base tabular-nums text-ink">{pricing ? <span className="skeleton inline-block h-5 w-16" /> : priced === 0 ? "—" : usdCompact(mcap)}</dd>
        </div>
        <div className="hidden flex-col gap-0.5 sm:flex">
          <dt className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">legs</dt>
          <dd className="font-mono text-base tabular-nums text-ink">{card.tokens.length}</dd>
        </div>
      </dl>

      <ul aria-label="Legs by weight" className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
        {shown.map((t, i) => (
          <li key={t.slug} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: colours[i] }} />
            <span className="text-ink">{t.ticker}</span>
            <span className="tabular-nums text-ink-faint">{t.weight}%</span>
          </li>
        ))}
        {more > 0 ? <li className="text-ink-faint">+{more} more</li> : null}
      </ul>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <div className="relative z-10 flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <a key={tag} className={cx("inline-flex h-6 items-center rounded-md border border-border bg-surface px-2 font-mono text-xs text-ink-muted", "hover:border-border-strong hover:text-ink")} href={galleryHref({ tag })}>
              #{tag}
            </a>
          ))}
        </div>
        <p className="text-xs text-ink-faint">{card.auto ? (dataSource() === "example" ? "example data" : "rebuilt from live data") : `${card.creatorName} · ${relativeDate(card.createdAt)}`}</p>
      </div>

      {actions !== undefined ? <div className="relative z-10 flex flex-wrap gap-2 border-t border-border pt-4">{actions}</div> : null}
    </li>
  );
}
