import { loadOntarioStores } from "./stores.mjs";
import { scanStores } from "./uber.mjs";
import { loadState, saveState } from "./state.mjs";
import { sendHealthAlert, sendStockAlert } from "./mailer.mjs";
import { confirmMatches, mergeActiveMatches, planBatch, updateHealth } from "./scheduler.mjs";

const concurrency = Math.max(1, Math.min(4, Number(process.env.CONCURRENCY || 2)));
const batchSize = Math.max(1, Math.min(40, Number(process.env.BATCH_SIZE || 18)));
const requestDelayMs = Math.max(0, Number(process.env.REQUEST_DELAY_MS || 2_000));
const confirmationDelayMs = Math.max(0, Number(process.env.CONFIRMATION_DELAY_MS || 10_000));
const maxStores = Math.max(0, Number(process.env.MAX_STORES || 0));
const dryRun = process.env.DRY_RUN === "true";
const now = Date.now();
const state = await loadState();
const { stores: loadedStores, source } = await loadOntarioStores();
const allStores = maxStores ? loadedStores.slice(0, maxStores) : loadedStores;
const plan = planBatch(allStores, state, Math.min(batchSize, allStores.length), now);

if (!plan.stores.length) {
  console.log(`No stores are due; global backoff lasts until ${plan.backoffUntil || "the next rotation"}.`);
  await saveState({ ...state, lastRunAt: new Date(now).toISOString(), lastRunStoreCount: 0 });
  process.exit(0);
}

console.log(
  `Checking batch of ${plan.stores.length}/${allStores.length} Ontario Walmart stores ` +
  `(${source}), concurrency ${concurrency}.`
);
const primary = await scanStores(plan.stores, concurrency, { requestDelayMs });

let confirmedMatches = [];
let confirmation = { checks: [], errors: [], matches: [], blocked: false };
if (primary.matches.length && !primary.blocked) {
  const positiveStores = [...new Map(primary.matches.map(({ store }) => [store.number, store])).values()];
  console.log(`Rechecking ${positiveStores.length} positive store(s) in a fresh browser session.`);
  if (confirmationDelayMs) await new Promise((resolve) => setTimeout(resolve, confirmationDelayMs));
  confirmation = await scanStores(positiveStores, 1, { requestDelayMs });
  confirmedMatches = confirmMatches(primary.matches, confirmation.matches);
}

const previous = new Set(state.activeMatchKeys || []);
const newMatches = confirmedMatches.filter(({ key }) => !previous.has(key));
if (newMatches.length) {
  console.log(`Found ${newMatches.length} newly confirmed match(es).`);
  if (!dryRun) await sendStockAlert(newMatches);
}

const zeroMatchStores = primary.checks
  .filter(({ error, matches }) => !error && matches.length === 0)
  .map(({ store }) => store.number);
const confirmedStoreNumbers = confirmation.checks
  .filter(({ error }) => !error)
  .map(({ store }) => store.number);
const updateableStoreNumbers = [...new Set([...zeroMatchStores, ...confirmedStoreNumbers])];
const activeMatchKeys = mergeActiveMatches(state.activeMatchKeys || [], confirmedMatches, updateableStoreNumbers);

const errors = [...primary.errors, ...confirmation.errors];
const attempted = primary.checks.length + confirmation.checks.length;
const failureRate = attempted ? errors.length / attempted : 0;
const lastHealth = state.lastHealthAlertAt ? Date.parse(state.lastHealthAlertAt) : 0;
const healthDue = now - lastHealth > 6 * 60 * 60 * 1000;
let lastHealthAlertAt = state.lastHealthAlertAt || null;
if (failureRate >= 0.2 && healthDue) {
  console.warn(`${errors.length}/${attempted} attempted checks failed.`);
  if (!dryRun) await sendHealthAlert(errors, attempted);
  lastHealthAlertAt = new Date(now).toISOString();
}

const blocked = primary.blocked || confirmation.blocked;
const attemptedPrimaryNumbers = new Set(primary.checks.map(({ store }) => store.number));
const lastAttemptedStore = [...plan.stores].reverse().find(({ number }) => attemptedPrimaryNumbers.has(number));
const nextCursor = primary.blocked && lastAttemptedStore
  ? plan.cursorAfterStore[lastAttemptedStore.number]
  : plan.nextCursor;
const health = updateHealth(state, primary.checks, { blocked, now, nextCursor });
await saveState({
  ...state,
  ...health,
  activeMatchKeys,
  lastHealthAlertAt,
  lastRunAt: new Date(now).toISOString(),
  lastRunStoreCount: primary.checks.length,
  lastRunErrorCount: errors.length,
  lastRunConfirmedCount: confirmedMatches.length
});

if (blocked) {
  throw new Error(`Uber challenged this runner; checks are paused until ${health.globalBackoffUntil}`);
}
if (primary.checks.length && primary.errors.length === primary.checks.length) {
  throw new Error("Every attempted store check failed; no stock alert was sent");
}
console.log(
  `Done: ${confirmedMatches.length} confirmed match(es), ${newMatches.length} new, ` +
  `${errors.length} error(s); next rotation starts at store index ${nextCursor}.`
);
