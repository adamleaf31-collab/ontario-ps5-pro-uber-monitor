import fs from "node:fs/promises";
import { STORE_QUERY } from "../src/stores.mjs";

const response = await fetch(STORE_QUERY, { signal: AbortSignal.timeout(20_000) });
if (!response.ok) throw new Error(`Store service returned HTTP ${response.status}`);
const payload = await response.json();
if (!Array.isArray(payload.features) || payload.features.length < 100) throw new Error("Invalid Ontario store data");

const stores = payload.features.map(({ attributes: a }) => ({
  name: a.StoreName || "Walmart",
  number: String(a.StoreNumbe || "unknown"),
  address: a.Address,
  city: a.City,
  postalCode: a.PostalCode,
  latitude: Number(a.Latitude),
  longitude: Number(a.Longitude)
}));

await fs.mkdir(new URL("../data/", import.meta.url), { recursive: true });
await fs.writeFile(new URL("../data/ontario-walmart-stores.json", import.meta.url), `${JSON.stringify({ generatedAt: new Date().toISOString(), stores }, null, 2)}\n`);
console.log(`Saved ${stores.length} Ontario Walmart stores.`);
