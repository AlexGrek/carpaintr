// Car model photos from the repo-root assets/{make}/{model}_{color}.jpg, bundled by Vite.
// Only URLs are inlined here; the images themselves are fetched lazily when
// rendered. Vite fingerprints each file (/assets/x5_black-<hash>.jpg), so the backend
// serves them as immutable and the service worker caches them cache-first.
const modules = import.meta.glob("../../../assets/*/*.jpg", {
  eager: true,
  query: "?url",
  import: "default",
});

// "Land Rover" / "land-rover" / "landrover" all map to the same key
const normalize = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const IMAGES = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => {
    const [, make, model] = path.match(/assets\/([^/]+)\/([^/]+?)(?:_[a-z]+)?\.jpg$/);
    return [`${normalize(make)}/${normalize(model)}`, url];
  }),
);

// Catalog keys whose photo is stored under a different model name
const ALIASES = {
  "kia/optima": "kia/k5",
  "toyota/landcruiserprado": "toyota/prado",
};

/** URL of the bundled photo for a make/model, or null when there is none. */
export const getCarModelImage = (make, model) => {
  if (!make || !model) return null;
  const key = `${normalize(make)}/${normalize(model)}`;
  return IMAGES[key] ?? IMAGES[ALIASES[key]] ?? null;
};
