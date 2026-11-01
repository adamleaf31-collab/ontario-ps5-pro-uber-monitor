import test from "node:test";
import assert from "node:assert/strict";
import { cleanProductText, isPs5ProConsole } from "../src/matcher.mjs";

test("accepts the PS5 Pro console", () => {
  assert.equal(isPs5ProConsole("Sony PlayStation 5 Pro Console"), true);
  assert.equal(isPs5ProConsole("PS5 Pro"), true);
});

test("rejects non-Pro consoles and accessories", () => {
  assert.equal(isPs5ProConsole("PlayStation 5 Digital Edition Console"), false);
  assert.equal(isPs5ProConsole("PS5 Pro DualSense Controller"), false);
  assert.equal(isPs5ProConsole("PS5 Pro Console Cover"), false);
  assert.equal(isPs5ProConsole("PS5 Portal Remote Player"), false);
});

test("rejects loose or ambiguous mentions", () => {
  assert.equal(isPs5ProConsole("Compatible with PS5 Pro"), false);
  assert.equal(isPs5ProConsole("PS5 Professional Gaming Headset"), false);
});

test("removes Uber Eats card prefixes", () => {
  assert.equal(cleanProductText("Quick Add\nCA$959.96\nSony PlayStation 5 Pro Console"), "Sony PlayStation 5 Pro Console");
});
