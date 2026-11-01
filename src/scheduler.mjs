const MINUTE = 60_000;
const MAX_STORE_BACKOFF = 6 * 60 * MINUTE;
const MAX_GLOBAL_BACKOFF = 6 * 60 * MINUTE;

function timestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function planBatch(stores, state, batchSize, now = Date.now()) {
  if (timestamp(state.globalBackoffUntil) > now) {
    return { stores: [], nextCursor: Number(state.storeCursor || 0), backoffUntil: state.globalBackoffUntil };
  }

  const selected = [];
  const cursorAfterStore = {};
  const total = stores.length;
  const start = total ? Number(state.storeCursor || 0) % total : 0;
  let inspected = 0;

  while (inspected < total && selected.length < Math.min(batchSize, total)) {
    const store = stores[(start + inspected) % total];
    const health = state.storeHealth?.[store.number] || {};
    if (timestamp(health.nextCheckAt) <= now) {
      selected.push(store);
      cursorAfterStore[store.number] = total ? (start + inspected + 1) % total : 0;
    }
    inspected += 1;
  }

  return {
    stores: selected,
    cursorAfterStore,
    nextCursor: total ? (start + inspected) % total : 0,
    backoffUntil: null
  };
}

export function updateHealth(state, checks, { blocked = false, now = Date.now(), nextCursor } = {}) {
  const storeHealth = { ...(state.storeHealth || {}) };

  for (const check of checks) {
    const previous = storeHealth[check.store.number] || {};
    if (!check.error) {
      storeHealth[check.store.number] = {
        failures: 0,
        lastCheckedAt: new Date(now).toISOString(),
        lastSuccessAt: new Date(now).toISOString(),
        nextCheckAt: null
      };
      continue;
    }

    const failures = Number(previous.failures || 0) + 1;
    const delay = Math.min(MAX_STORE_BACKOFF, 10 * MINUTE * (2 ** (failures - 1)));
    storeHealth[check.store.number] = {
      ...previous,
      failures,
      lastCheckedAt: new Date(now).toISOString(),
      lastError: check.error,
      nextCheckAt: new Date(now + delay).toISOString()
    };
  }

  const previousBlocks = Number(state.globalBlockCount || 0);
  const globalBlockCount = blocked ? previousBlocks + 1 : 0;
  const globalDelay = blocked
    ? Math.min(MAX_GLOBAL_BACKOFF, 15 * MINUTE * (2 ** (globalBlockCount - 1)))
    : 0;

  return {
    storeHealth,
    storeCursor: nextCursor ?? Number(state.storeCursor || 0),
    globalBlockCount,
    globalBackoffUntil: blocked ? new Date(now + globalDelay).toISOString() : null
  };
}

export function confirmMatches(primaryMatches, confirmationMatches) {
  const confirmedKeys = new Set(confirmationMatches.map(({ key }) => key));
  return primaryMatches.filter(({ key }) => confirmedKeys.has(key));
}

export function mergeActiveMatches(previousKeys, confirmedMatches, updateableStoreNumbers) {
  const updateable = new Set(updateableStoreNumbers.map(String));
  const next = new Set(
    previousKeys.filter((key) => !updateable.has(String(key).split("|", 1)[0]))
  );
  for (const { key } of confirmedMatches) next.add(key);
  return [...next].sort();
}
