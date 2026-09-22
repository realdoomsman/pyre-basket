import { useEffect, useState } from "react";
import { pyreEnv } from "@pyre/app-sdk";
import { AdSlot, LoginButton } from "@pyre/app-sdk/react";
import Builder from "./components/Builder";
import Detail from "./components/Detail";
import Gallery from "./components/Gallery";
import Mine from "./components/Mine";
import { btnGhost } from "./ui";

type Route =
  | { name: "gallery" }
  | { name: "builder"; editId?: string }
  | { name: "detail"; id: string }
  | { name: "mine" };

function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [head, tail] = path.split("/");
  if (head === "new") return { name: "builder" };
  if (head === "edit" && tail) return { name: "builder", editId: tail };
  if (head === "b" && tail) return { name: "detail", id: tail };
  if (head === "mine") return { name: "mine" };
  return { name: "gallery" };
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = (): void => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

const NAV: { href: string; text: string; match: Route["name"] }[] = [
  { href: "#/", text: "Gallery", match: "gallery" },
  { href: "#/new", text: "Build", match: "builder" },
  { href: "#/mine", text: "My baskets", match: "mine" },
];

export default function App() {
  const env = pyreEnv();
  const route = useRoute();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{env.name ?? "Basket"}</h1>
            <p className="mt-0.5 text-sm text-ink-faint">Weighted memecoin lists you can actually shop from.</p>
          </div>
          <LoginButton className={btnGhost}>Log in</LoginButton>
        </div>
        <nav aria-label="Sections">
          <ul className="flex gap-1 rounded-xl border border-edge/70 bg-panel/60 p-1 text-sm">
            {NAV.map((item) => {
              const active = route.name === item.match;
              return (
                <li className="flex-1" key={item.href}>
                  <a
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 text-center font-medium transition ${
                      active ? "bg-panel-2 text-ink" : "text-ink-faint hover:text-ink"
                    }`}
                    href={item.href}
                  >
                    {item.text}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="flex flex-1 flex-col gap-8">
        {route.name === "gallery" ? (
          <section className="rounded-2xl border border-edge/70 bg-panel/50 p-5 sm:p-6">
            <p className="text-base leading-relaxed text-ink-dim sm:text-lg">
              A basket is a themed list of memecoins with a weight each. Open one, type your budget, and get the exact
              dollar amount to put into every coin — then buy them yourself. Basket holds no funds and places no
              orders.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110"
                href="#/new"
              >
                Build a basket
              </a>
              <a className={btnGhost} href="#/b/demo-dog-coins">
                See an example
              </a>
            </div>
          </section>
        ) : null}

        {route.name === "gallery" ? <Gallery /> : null}
        {route.name === "builder" ? <Builder editId={route.editId} /> : null}
        {route.name === "detail" ? <Detail id={route.id} /> : null}
        {route.name === "mine" ? <Mine /> : null}
      </main>

      <footer className="mt-auto flex flex-col gap-4 border-t border-edge/60 pt-6 text-xs text-ink-faint">
        <AdSlot className="flex items-center gap-3 rounded-xl border border-edge/60 p-3 text-ink-dim no-underline" />
        <p className="leading-relaxed">
          Baskets are planning tools, not funds: no custody, no trade execution, no live prices, and nothing here is
          financial advice. Tickers are typed by users and unverified — confirm the contract address before you buy.
          {env.ticker ? ` Funded by $${env.ticker} on Pyre.` : " Built on Pyre."}
        </p>
      </footer>
    </div>
  );
}
