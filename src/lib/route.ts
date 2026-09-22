import { useEffect, useState } from "react";
import type { GalleryQuery, GallerySort } from "../types";

export type Route =
  | { name: "gallery"; query: GalleryQuery }
  | { name: "detail"; id: string }
  | { name: "builder"; editId: string | null }
  | { name: "mine" };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const qIndex = path.indexOf("?");
  const segments = (qIndex === -1 ? path : path.slice(0, qIndex)).split("/");
  const params = new URLSearchParams(qIndex === -1 ? "" : path.slice(qIndex + 1));
  const [head, tail = ""] = segments;

  if (head === "new") return { name: "builder", editId: null };
  if (head === "edit" && ID_RE.test(tail)) return { name: "builder", editId: tail };
  if (head === "b" && ID_RE.test(tail)) return { name: "detail", id: tail };
  if (head === "mine") return { name: "mine" };

  const rawSort = params.get("sort");
  const sort: GallerySort = rawSort === "featured" || rawSort === "24h" ? rawSort : "newest";
  return {
    name: "gallery",
    query: {
      q: (params.get("q") ?? "").trim().slice(0, 60),
      tag: (params.get("tag") ?? "").trim().toLowerCase().slice(0, 40),
      sort,
    },
  };
}

export function galleryHref(query: Partial<GalleryQuery>): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.tag) params.set("tag", query.tag);
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);
  const qs = params.toString();
  return qs === "" ? "#/" : `#/?${qs}`;
}

export function detailHref(id: string): string {
  return `#/b/${encodeURIComponent(id)}`;
}

export function editHref(id: string): string {
  return `#/edit/${encodeURIComponent(id)}`;
}

export function navigate(href: string): void {
  if (window.location.hash === href) return;
  window.location.hash = href;
}

/** Replaces the hash without adding a history entry: used for search-as-you-type. */
export function replaceHash(href: string): void {
  if (window.location.hash === href) return;
  window.history.replaceState(null, "", href);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = (): void => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
