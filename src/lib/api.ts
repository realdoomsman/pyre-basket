import { ship } from "@pyre/app-sdk";
import type { AssistResult, BasketResult, GalleryResult, MineResult, PublishInput, PublishResult, RemoveResult } from "../types";

/** Typed wrappers over `functions/*.js`. One place to look when a wire shape changes. */
export const api = {
  gallery: () => ship.fn<GalleryResult>("gallery", {}),
  basket: (id: string) => ship.fn<BasketResult>("basket", { id }),
  mine: () => ship.fn<MineResult>("mine", {}),
  publish: (input: PublishInput) => ship.fn<PublishResult>("publish", input),
  remove: (id: string) => ship.fn<RemoveResult>("remove", { id }),
  assist: (input: { tokens: { ticker: string }[]; goal: string }) => ship.fn<AssistResult>("assist", input),
};
