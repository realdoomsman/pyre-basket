import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

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

test("the home page shows the app heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(await appName());
});

test("the gallery lists baskets and filters by search", async ({ page }) => {
  await page.goto("/");
  const list = page.getByTestId("gallery-list");
  await expect(list).toBeVisible();
  await expect(list.getByRole("listitem")).not.toHaveCount(0);

  await page.getByLabel("Search by coin, tag or title").fill("PEPE");
  await expect(list.getByRole("heading", { name: "Frog Pond" })).toBeVisible();
  await expect(list.getByRole("heading", { name: "Dog Coins" })).toHaveCount(0);
});

test("a basket detail page splits a budget across its coins", async ({ page }) => {
  await page.goto("/#/b/demo-dog-coins");
  await expect(page.getByTestId("basket-title")).toHaveText("Dog Coins");

  // Dog Coins is DOGE 40 / SHIB 25 / WIF 20 / BONK 15 — $200 splits accordingly.
  await page.getByLabel("Your budget (USD)").fill("200");
  await expect(page.getByTestId("split-DOGE")).toHaveText("$80.00");
  await expect(page.getByTestId("split-SHIB")).toHaveText("$50.00");
  await expect(page.getByTestId("split-WIF")).toHaveText("$40.00");
  await expect(page.getByTestId("split-BONK")).toHaveText("$30.00");
});

test("the builder validates weights and asks anonymous users to log in", async ({ page }) => {
  await page.goto("/#/new");

  await page.getByLabel("Ticker 1").fill("doge");
  await page.getByLabel("Ticker 2").fill("pepe");
  await page.getByLabel("Weight %", { exact: false }).first().fill("70");
  await expect(page.getByTestId("weight-total")).toHaveText("70% of 100%");

  await page.getByRole("button", { name: "Even split" }).click();
  await expect(page.getByTestId("weight-total")).toHaveText("100% of 100%");

  // The weights preview lists the normalised tickers.
  await expect(page.getByRole("img", { name: /Weight breakdown/ })).toBeVisible();
  await expect(page.getByText("DOGE", { exact: true }).first()).toBeVisible();

  // Publishing needs an account; the rest of the builder does not.
  await expect(page.getByTestId("publish-login")).toBeVisible();
});

test("the builder offers the Pro unlock instead of the assistant to free users", async ({ page }) => {
  await page.goto("/#/new");
  await expect(page.getByRole("heading", { name: /Basket Pro/ })).toBeVisible();
});

test("a tag on a basket page deep-links into a filtered gallery", async ({ page }) => {
  await page.goto("/#/b/demo-dog-coins");
  await page.getByRole("link", { name: "#dogs" }).click();

  await expect(page).toHaveURL(/#\/\?tag=dogs$/);
  const list = page.getByTestId("gallery-list");
  await expect(list.getByRole("heading", { name: "Dog Coins" })).toBeVisible();
  await expect(list.getByRole("heading", { name: "Frog Pond" })).toHaveCount(0);
});

test("the gallery honours a ?tag= filter on direct load and clears it", async ({ page }) => {
  await page.goto("/#/?tag=frogs");
  const list = page.getByTestId("gallery-list");
  await expect(list.getByRole("heading", { name: "Frog Pond" })).toBeVisible();
  await expect(list.getByRole("heading", { name: "Dog Coins" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "#frogs" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "All" }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(list.getByRole("heading", { name: "Dog Coins" })).toBeVisible();
});

test("a tag chip inside a gallery card refilters without leaving the gallery", async ({ page }) => {
  await page.goto("/#/");
  const list = page.getByTestId("gallery-list");
  await list.getByRole("link", { name: "#classics" }).click();

  await expect(page).toHaveURL(/#\/\?tag=classics$/);
  await expect(list.getByRole("heading", { name: "Dog Coins" })).toBeVisible();
  await expect(list.getByRole("heading", { name: "Frog Pond" })).toHaveCount(0);
});

test("My baskets asks a signed-out visitor to log in without erroring", async ({ page }) => {
  await page.goto("/#/mine");
  const region = page.getByRole("region", { name: "My baskets" });
  await expect(region.getByRole("heading", { name: "Log in to save baskets" })).toBeVisible();
  await expect(region.getByRole("button", { name: "Log in" })).toBeVisible();
});
