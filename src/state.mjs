import fs from "node:fs/promises";
import path from "node:path";

const STATE_PATH = path.resolve(".state/state.json");

export async function loadState() {
  try {
    return {
      activeMatchKeys: [],
      lastHealthAlertAt: null,
      storeCursor: 0,
      storeHealth: {},
      globalBlockCount: 0,
      globalBackoffUntil: null,
      ...JSON.parse(await fs.readFile(STATE_PATH, "utf8"))
    };
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(`State could not be read: ${error.message}`);
    return {
      activeMatchKeys: [],
      lastHealthAlertAt: null,
      storeCursor: 0,
      storeHealth: {},
      globalBlockCount: 0,
      globalBackoffUntil: null
    };
  }
}

export async function saveState(state) {
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
  const temporary = `${STATE_PATH}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
  await fs.rename(temporary, STATE_PATH);
}
