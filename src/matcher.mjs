const ACCESSORY_WORDS = [
  "controller", "dualsense", "portal", "disc drive", "cover", "stand",
  "headset", "case", "skin", "charger", "charging", "remote", "cable",
  "faceplate", "grip", "thumbstick", "screen protector"
];

export function normalizeTitle(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[™®©]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export function isPs5ProConsole(title) {
  const text = normalizeTitle(title);
  if (!/\b(?:ps5|playstation 5)\s+pro\b/.test(text)) return false;
  if (ACCESSORY_WORDS.some((word) => text.includes(word))) return false;

  const exactModel = /^(?:sony\s+)?(?:ps5|playstation 5)\s+pro(?:\s+console)?$/.test(text);
  const namedConsole = /\bconsole\b/.test(text);
  return exactModel || namedConsole;
}

export function cleanProductText(value) {
  return String(value ?? "")
    .replace(/^Quick Add\s*/i, "")
    .replace(/^CA\$[\d,.]+\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
