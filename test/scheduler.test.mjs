import test from "node:test";
import assert from "node:assert/strict";
import { confirmMatches, mergeActiveMatches, planBatch, updateHealth } from "../src/scheduler.mjs";

const stores = ["1", "2", "3", "4"].map((number) => ({ number }));

test("rotates through a bounded batch", () => {
  const first = planBatch(stores, { storeCursor: 0, storeHealth: {} }, 2, 1000);
  assert.deepEqual(first.stores.map(({ number }) => number), ["1", "2"]);
  assert.equal(first.nextCursor, 2);
  const second = planBatch(stores, { storeCursor: first.nextCursor, storeHealth: {} }, 2, 1000);
  assert.deepEqual(second.stores.map(({ number }) => number), ["3", "4"]);
});

test("skips stores in failure backoff", () => {
  const plan = planBatch(stores, {
    storeCursor: 0,
    storeHealth: { "1": { nextCheckAt: new Date(2000).toISOString() } }
  }, 2, 1000);
  assert.deepEqual(plan.stores.map(({ number }) => number), ["2", "3"]);
  assert.equal(plan.cursorAfterStore["2"], 2);
  assert.equal(plan.cursorAfterStore["3"], 3);
});

test("requires the same match in a second pass", () => {
  const primary = [{ key: "1|ps5 pro" }, { key: "2|ps5 pro" }];
  assert.deepEqual(confirmMatches(primary, [{ key: "2|ps5 pro" }]), [{ key: "2|ps5 pro" }]);
});

test("replaces active matches only for successfully updated stores", () => {
  const merged = mergeActiveMatches(["1|old", "2|keep"], [{ key: "1|new" }], ["1"]);
  assert.deepEqual(merged, ["1|new", "2|keep"]);
});

test("adds exponential store and global backoff after a block", () => {
  const next = updateHealth(
    { storeHealth: {}, globalBlockCount: 0 },
    [{ store: stores[0], error: "blocked" }],
    { blocked: true, now: 0, nextCursor: 1 }
  );
  assert.equal(next.storeHealth["1"].failures, 1);
  assert.equal(Date.parse(next.storeHealth["1"].nextCheckAt), 10 * 60_000);
  assert.equal(Date.parse(next.globalBackoffUntil), 15 * 60_000);
  assert.equal(next.storeCursor, 1);
});
