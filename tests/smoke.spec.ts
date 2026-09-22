import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

/**
 * The deployment manifest is the source of truth for the app's name; the page's
 * <h1> has to agree with it, so this catches a renamed app with a stale manifest
 * (or the other way round).
 */
const appName = async (): Promise<string> => {
  const manifest: unknown = JSON.parse(await readFile("pyre.manifest.json", "utf8"));
  const name = manifest !== null && typeof manifest === "object" && "name" in manifest ? manifest.name : null;
  if (typeof name !== "string" || name === "") throw new Error("pyre.manifest.json has no name");
  return name;
};

/** Dollar text like "$1,234.56" → cents. */
const cents = (text: string): number => Math.round(Number(text.replace(/[^0-9.-]/g, "")) * 100);

/** The local host has no coin feed, so the gallery is built from the example dataset. */
const openGallery = async (page: Page): Promise<void> => {
  await page.goto("/");
  await expect(page.getByTestId("gallery-list")).toBeVisible();
};

test("the home page shows the app heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(await appName());
});

test("the gallery lists auto baskets with live-style numbers and says the data is an example", async ({ page }) => {
  await openGallery(page);
  const list = page.getByTestId("gallery-list");
  await expect(list.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) })).toHaveCount(3);
  await expect(page.getByTestId("example-banner")).toBeVisible();

  // Trending, equal weight: EXA..EXE at 20% each → weighted 24h = (12.4 − 3.1 + 41.7 + 0.8 − 18.6) / 5.
  const card = list.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Trending, equal weight" }) });
  await expect(card.getByText("+6.6%")).toBeVisible();
  await expect(card.getByText("$40.92M")).toBeVisible();
});

test("search narrows the gallery by ticker and clears again", async ({ page }) => {
  await openGallery(page);
  const list = page.getByTestId("gallery-list");
  await page.getByLabel("Search by coin, tag or title").fill("EXH");
  await expect(list.getByRole("heading", { name: "Fresh launches" })).toBeVisible();
  await expect(list.getByRole("heading", { name: "Trending, equal weight" })).toHaveCount(0);
  await expect(page).toHaveURL(/q=EXH/);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(list.getByRole("heading", { name: "Trending, equal weight" })).toBeVisible();
});

test("a tag chip filters, deep-links and is pressed on direct load", async ({ page }) => {
  await page.goto("/#/?tag=new");
  const list = page.getByTestId("gallery-list");
  await expect(list.getByRole("heading", { name: "Fresh launches" })).toBeVisible();
  await expect(list.getByRole("heading", { name: "Trending, equal weight" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "#new" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "All" }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(list.getByRole("heading", { name: "Trending, equal weight" })).toBeVisible();
});

test("sorting by 24h puts the best-performing basket first", async ({ page }) => {
  await page.goto("/#/?sort=24h");
  const headings = page.getByTestId("gallery-list").getByRole("heading", { level: 3 });
  await expect(headings.first()).toHaveText("Trending, cap weighted");
});

test("a basket page sizes every leg so the amounts add up to the budget exactly", async ({ page }) => {
  await openGallery(page);
  await page.getByRole("link", { name: "Trending, cap weighted" }).click();
  await expect(page.getByTestId("basket-title")).toHaveText("Trending, cap weighted");

  // An awkward budget: eight legs at 46/9/3/25/2/12/1/2 cannot split $77.77 evenly.
  await page.getByLabel("Your budget (USD)").fill("77.77");
  await expect(page.getByTestId("split-total")).toHaveText("$77.77");
  const rows = page.locator("[data-testid^='split-']:not([data-testid='split-total'])");
  await expect(rows).toHaveCount(8);
  const parts = await rows.allTextContents();
  expect(parts.reduce((acc, t) => acc + cents(t), 0)).toBe(7777);
  // 46% of $77.77 is $35.7742 → rounds to $35.77 before the remainder cents are handed out.
  expect(cents(parts[0] ?? "")).toBeGreaterThanOrEqual(3577);
  expect(cents(parts[0] ?? "")).toBeLessThanOrEqual(3578);

  await expect(page.getByRole("link", { name: "Trade on Pyre" }).first()).toHaveAttribute("href", "https://pyre.fun/c/example-alpha");
  await expect(page.getByRole("img", { name: /Equity curve/ })).toBeVisible();
});

test("the detail page tells a signed-out visitor what the numbers are based on", async ({ page }) => {
  await page.goto("/#/b/auto-new");
  await expect(page.getByTestId("basket-title")).toHaveText("Fresh launches");
  // EXG has no 24h history, so the headline covers 80% of the basket and says so.
  await expect(page.getByText("covers 80% of the basket").first()).toBeVisible();
});

test("an unknown basket id shows an empty state instead of an error", async ({ page }) => {
  await page.goto("/#/b/does-not-exist");
  await expect(page.getByText("No basket here")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to gallery" })).toBeVisible();
});

test("the builder picks coins from the universe, validates the split and asks anonymous users to sign in", async ({ page }) => {
  await page.goto("/#/new");
  await page.getByRole("button", { name: "Add EXA" }).click();
  await page.getByRole("button", { name: "Add EXB" }).click();
  await expect(page.getByRole("button", { name: "EXA added" })).toBeDisabled();
  await expect(page.getByTestId("weight-total")).toHaveText("100% of 100%");

  await page.getByLabel("Weight % 1").fill("70");
  await expect(page.getByTestId("weight-total")).toHaveText("120% of 100%");
  await page.getByRole("button", { name: "Scale to 100" }).click();
  await expect(page.getByTestId("weight-total")).toHaveText("100% of 100%");
  await expect(page.getByLabel("Weight % 1")).toHaveValue("58");
  await expect(page.getByLabel("Weight % 2")).toHaveValue("42");

  await page.getByRole("button", { name: "Equal split" }).click();
  await expect(page.getByLabel("Weight % 1")).toHaveValue("50");

  await page.getByRole("button", { name: "Remove EXB" }).click();
  await expect(page.getByText("At least 2 legs (1 so far)")).toBeVisible();

  // Publishing needs an account; the rest of the builder does not.
  await expect(page.getByTestId("publish-login")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to publish" })).toBeVisible();
});

test("remix carries a basket into the builder", async ({ page }) => {
  await page.goto("/#/b/auto-trending");
  await page.getByRole("button", { name: "Remix" }).click();
  await expect(page).toHaveURL(/#\/new$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Build a basket");
  await expect(page.getByLabel("Title")).toHaveValue("Trending, equal weight remix");
  await expect(page.getByTestId("weight-total")).toHaveText("100% of 100%");
});

test("My baskets asks a signed-out visitor to sign in without erroring", async ({ page }) => {
  await page.goto("/#/mine");
  const region = page.getByRole("region", { name: "My baskets" });
  await expect(region.getByText("Sign in to save baskets")).toBeVisible();
  await expect(region.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(region.getByText("Holder perks")).toBeVisible();
});
