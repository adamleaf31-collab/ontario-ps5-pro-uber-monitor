import { chromium } from "playwright";
import { cleanProductText, isPs5ProConsole } from "./matcher.mjs";

const SEARCH_URL = "https://www.ubereats.com/ca/search?q=PS5%20Pro";
const CHALLENGE_MARKER = "UBER_CLOUD_CHALLENGE";

async function chooseAddress(page, store) {
  const input = page.getByRole("combobox", { name: /enter delivery address/i });
  await input.waitFor({ state: "visible", timeout: 20_000 });
  await input.fill(`${store.address}, ${store.city}, ON ${store.postalCode}`);
  const firstOption = page.getByRole("option").first();
  await firstOption.waitFor({ state: "visible", timeout: 15_000 });
  await firstOption.click();

  const searchHere = page.getByRole("button", { name: /search here/i });
  if (await searchHere.isVisible({ timeout: 3_000 }).catch(() => false)) await searchHere.click();
}

async function extractWalmartMatches(page, store) {
  await page.getByText(/results for/i).first().waitFor({ state: "visible", timeout: 25_000 });
  const cards = page.locator('a[href*="/ca/store/walmart-"]');
  const count = await cards.count();
  const matches = [];

  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const text = cleanProductText(await card.innerText().catch(() => ""));
    if (!isPs5ProConsole(text)) continue;
    if (/sold out|unavailable/i.test(text)) continue;
    const quickAdd = card.getByRole("button", { name: /quick add/i });
    if (!(await quickAdd.isEnabled().catch(() => false))) continue;

    const href = await card.getAttribute("href");
    matches.push({
      key: `${store.number}|${text.toLowerCase()}`,
      title: text,
      store,
      url: href ? new URL(href, page.url()).href : SEARCH_URL,
      foundAt: new Date().toISOString()
    });
  }
  return matches;
}

async function scanStore(browser, store) {
  const context = await browser.newContext({ locale: "en-CA", timezoneId: "America/Toronto" });
  const page = await context.newPage();
  try {
    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (/def\.uber\.com\/.*challenge/i.test(page.url())) {
      throw new Error(`${CHALLENGE_MARKER}: Uber rejected this cloud runner`);
    }
    const cookieButton = page.getByRole("button", { name: /got it/i });
    if (await cookieButton.isVisible({ timeout: 1_500 }).catch(() => false)) await cookieButton.click();
    await chooseAddress(page, store);
    return await extractWalmartMatches(page, store);
  } catch (error) {
    const title = await page.title().catch(() => "unknown");
    throw new Error(`${error.message} [url=${page.url()}, title=${title}]`);
  } finally {
    await context.close();
  }
}

async function withRetry(browser, store) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return { matches: await scanStore(browser, store), error: null };
    } catch (error) {
      lastError = error;
      if (error.message.includes(CHALLENGE_MARKER)) break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1_000 + Math.random() * 2_000));
    }
  }
  return { matches: [], error: `${store.city} #${store.number}: ${lastError.message}` };
}

export async function scanStores(stores, concurrency = 6) {
  const browser = await chromium.launch({ headless: process.env.HEADED !== "true" });
  const results = { matches: [], errors: [], blocked: false };
  let cursor = 0;

  async function worker() {
    while (cursor < stores.length && !results.blocked) {
      const store = stores[cursor++];
      const result = await withRetry(browser, store);
      results.matches.push(...result.matches);
      if (result.error) {
        results.errors.push(result.error);
        if (result.error.includes(CHALLENGE_MARKER)) results.blocked = true;
        console.warn(`[${cursor}/${stores.length}] ${result.error}`);
      } else {
        console.log(`[${cursor}/${stores.length}] ${store.city} #${store.number}: ${result.matches.length} match(es)`);
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, stores.length) }, worker));
  } finally {
    await browser.close();
  }
  return results;
}
