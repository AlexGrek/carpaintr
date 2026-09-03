/**
 * Canonical work categories.
 *
 * Every repair task belongs to exactly one of four trades. The keys below are
 * stable ASCII identifiers, deliberately *not* the Ukrainian display strings:
 * categories are used as object keys and join targets, and the catalog data is
 * already full of Cyrillic strings that differ by invisible whitespace
 * ("Двері  багажника" vs "Двері багажника", "УНИВЕРСАЛ " with a trailing
 * space). Display names go through the i18n layer instead.
 */
export const WORK_CATEGORIES = ["arm", "body", "paint", "extra"];

/**
 * Sequence in which the trades touch the car — also the order categories are
 * rendered and printed in.
 */
export const WORK_CATEGORY_ORDER = { arm: 1, body: 2, paint: 3, extra: 4 };

/**
 * Bucket for rows whose processor has no (or an unrecognised) category. Sorts
 * after every known category so uncategorised work is visible at the end
 * rather than silently dropped.
 */
export const UNCATEGORIZED = "uncategorized";

/**
 * English labels for each category key. Ukrainian translations are registered
 * through `registerTranslations` in `LocaleContext`; pass these through `str()`
 * to render them.
 */
export const WORK_CATEGORY_LABELS = {
  arm: "Assembly works",
  body: "Body works",
  paint: "Paint works",
  extra: "Additional works",
  [UNCATEGORIZED]: "Uncategorized",
};

/**
 * Options for a `SelectPicker` bound to the category field.
 * @param {(s: string) => string} [str] - localization function; identity if omitted.
 */
export function workCategoryOptions(str = (s) => s) {
  return WORK_CATEGORIES.map((value) => ({
    value,
    label: str(WORK_CATEGORY_LABELS[value]),
  }));
}

/**
 * Normalize a processor's `category` into a known key, falling back to
 * `UNCATEGORIZED` for empty, legacy ("General") or unrecognised values.
 * @param {*} category
 * @returns {string}
 */
export function normalizeCategory(category) {
  return WORK_CATEGORIES.includes(category) ? category : UNCATEGORIZED;
}

/**
 * Sort rank for a category key. Unknown categories sort last.
 * @param {*} category
 * @returns {number}
 */
export function categoryRank(category) {
  return WORK_CATEGORY_ORDER[category] ?? Number.MAX_SAFE_INTEGER;
}
