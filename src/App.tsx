import { LoginButton } from "@pyre/app-sdk/react";
import { buttonClass, cx, ToastProvider } from "./components";
import { dataSource } from "./lib/coins";
import { useRoute, type Route } from "./lib/route";
import { Builder } from "./pages/Builder";
import { Detail } from "./pages/Detail";
import { Gallery } from "./pages/Gallery";
import { Mine } from "./pages/Mine";

const NAV: { href: string; text: string; match: Route["name"] }[] = [
  { href: "#/", text: "Gallery", match: "gallery" },
  { href: "#/new", text: "Build", match: "builder" },
  { href: "#/mine", text: "My baskets", match: "mine" },
];

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case "gallery":
      return <Gallery query={route.query} />;
    case "detail":
      return <Detail id={route.id} />;
    case "builder":
      return <Builder key={route.editId ?? "new"} editId={route.editId} />;
    case "mine":
      return <Mine />;
  }
}

export default function App() {
  const route = useRoute();
  const active = route.name === "detail" ? "gallery" : route.name;
  const example = dataSource() === "example";

  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-border py-3">
          <nav aria-label="Primary" className="flex gap-1">
            {NAV.map((item) => {
              const current = item.match === active;
              return (
                <a
                  key={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "rounded-card px-3 py-1.5 text-sm font-medium transition-colors",
                    current ? "bg-surface-raised text-ink" : "text-ink-muted hover:bg-surface hover:text-ink",
                  )}
                  href={item.href}
                >
                  {item.text}
                </a>
              );
            })}
          </nav>
          <LoginButton className={buttonClass("secondary", "sm")}>Sign in</LoginButton>
        </div>

        {example ? (
          <p className="border-b border-border py-2 font-mono text-xs text-ink-faint" data-testid="example-banner">
            example data: this host has no coin feed, so every number on screen is a placeholder.
          </p>
        ) : null}

        <main className="flex-1 py-8 sm:py-10">
          <Page route={route} />
        </main>

        <footer className="flex flex-col gap-2 border-t border-border py-6 text-sm text-ink-faint">
          <p>
            Basket is a list-making tool, not an investable product, and nothing here is financial advice. The app holds
            no funds: buying happens on Pyre, in your own wallet, one coin at a time.
          </p>
          <p>Prices, market caps and 24h moves come from Pyre and can lag the market. Powered by Pyre.</p>
        </footer>
      </div>
    </ToastProvider>
  );
}
