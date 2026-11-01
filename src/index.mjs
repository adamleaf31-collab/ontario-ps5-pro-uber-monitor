import { loadOntarioStores } from "./stores.mjs";
import { scanStores } from "./uber.mjs";
import { loadState, saveState } from "./state.mjs";
import { sendHealthAlert, sendStockAlert } from "./mailer.mjs";

const concurrency = Math.max(1, Math.min(10, Number(process.env.CONCURRENCY || 6)));
const maxStores = Math.max(0, Number(process.env.MAX_STORES || 0));
const dryRun = process.env.DRY_RUN === "true";
const state = await loadState();
const { stores: allStores, source } = await loadOntarioStores();
const stores = maxStores ? allStores.slice(0, maxStores) : allStores;

console.log(`Checking ${stores.length} Ontario Walmart stores (${source}), concurrency ${concurrency}.`);
const { matches, errors, blocked } = await scanStores(stores, concurrency);
const previous = new Set(state.activeMatchKeys || []);
const newMatches = matches.filter(({ key }) => !previous.has(key));
const failureRate = errors.length / stores.length;
const lastHealth = state.lastHealthAlertAt ? Date.parse(state.lastHealthAlertAt) : 0;
const healthDue = Date.now() - lastHealth > 6 * 60 * 60 * 1000;

if (newMatches.length) {
  console.log(`Found ${newMatches.length} new match(es).`);
  if (!dryRun) await sendStockAlert(newMatches);
}

let lastHealthAlertAt = state.lastHealthAlertAt || null;
if (failureRate >= 0.2 && healthDue) {
  console.warn(`${errors.length}/${stores.length} checks failed.`);
  if (!dryRun) await sendHealthAlert(errors, stores.length);
  lastHealthAlertAt = new Date().toISOString();
}

await saveState({
  activeMatchKeys: matches.map(({ key }) => key),
  lastHealthAlertAt,
  lastRunAt: new Date().toISOString(),
  lastRunStoreCount: stores.length,
  lastRunErrorCount: errors.length
});

if (blocked) {
  throw new Error("Uber blocked this cloud runner with its anti-bot challenge; no inventory result is valid");
}

if (errors.length === stores.length) {
  throw new Error("All store checks failed; state was preserved and no stock alert was sent");
}
console.log(`Done: ${matches.length} current match(es), ${newMatches.length} new, ${errors.length} error(s).`);
