// The calculation stores the catalog name; use the matching swatch to choose
// the closest available light or dark photo without changing saved data.
export function carImageColor(name, colors) {
  if (!name || !Array.isArray(colors)) return "black";
  const color = colors.find((item) => item.name_ukr === name || item.name_eng === name);
  if (!color) return "black";
  if (/^(темно|dark)/i.test(name)) return "black";
  if (/^(світло|light|блідий|pale)/i.test(name)) return "white";
  const match = /^#([\da-f]{6})$/i.exec(color.hex ?? "");
  if (!match) return "black";
  const hex = match[1];
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b >= 150 ? "white" : "black";
}
