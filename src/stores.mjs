import fs from "node:fs/promises";

export const STORE_QUERY = "https://services.arcgis.com/XG6drQ22VvDVg6Fs/ArcGIS/rest/services/Walmart_Locations_/FeatureServer/0/query?where=Country%3D%27Canada%27%20AND%20State%3D%27ON%27%20AND%20Label%3D%27Walmart%27%20AND%20OpenStatus%3D%27Open%27&outFields=StoreName%2CStoreNumbe%2CAddress%2CCity%2CPostalCode%2CLatitude%2CLongitude&returnGeometry=false&f=json";

function normalizeStore(attributes) {
  return {
    name: attributes.StoreName || "Walmart",
    number: String(attributes.StoreNumbe || "unknown"),
    address: attributes.Address,
    city: attributes.City,
    postalCode: attributes.PostalCode,
    latitude: Number(attributes.Latitude),
    longitude: Number(attributes.Longitude)
  };
}

function validate(stores) {
  const valid = stores.filter((store) =>
    store.address && store.city && store.postalCode && Number.isFinite(store.latitude) && Number.isFinite(store.longitude)
  );
  if (valid.length < 100) throw new Error(`Ontario store list is unexpectedly small (${valid.length})`);
  return valid.sort((a, b) => `${a.city}-${a.number}`.localeCompare(`${b.city}-${b.number}`));
}

async function fetchLiveStores() {
  const response = await fetch(STORE_QUERY, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Store service returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.features)) throw new Error("Store service returned invalid data");
  return validate(payload.features.map(({ attributes }) => normalizeStore(attributes)));
}

export async function loadOntarioStores(snapshotPath = new URL("../data/ontario-walmart-stores.json", import.meta.url)) {
  try {
    return { stores: await fetchLiveStores(), source: "live" };
  } catch (error) {
    console.warn(`Live store list unavailable: ${error.message}. Using bundled snapshot.`);
    const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
    return { stores: validate(snapshot.stores), source: `snapshot-${snapshot.generatedAt}` };
  }
}
