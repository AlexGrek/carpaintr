/**
 * Human-readable names for the built-in printable document templates.
 *
 * `GET /api/v1/user/list_templates` returns raw filenames from
 * `doc_templates/*.html` (e.g. "calculation_ua.html") — these are storage
 * keys, not something to show a shop operator. This maps each known
 * filename to an English label key; the Ukrainian text is registered
 * through the i18n layer (`registerTranslations`) in the component that
 * renders the picker, so `str()` resolves the right one per locale.
 */
export const DOCUMENT_TEMPLATE_LABELS = {
  "calculation_ua.html": "Calculation",
  "work_order_category_ua.html": "Work order by category",
};

/**
 * Resolve a display label for a template filename.
 * Falls back to the filename stem (extension stripped, underscores turned
 * into spaces) for templates not in the map above, so a newly added
 * template is still usable before someone gets around to naming it here.
 *
 * @param {string} filename - e.g. "calculation_ua.html"
 * @param {(s: string) => string} [str] - localization function; identity if omitted
 * @returns {string}
 */
export function getTemplateLabel(filename, str = (s) => s) {
  const known = DOCUMENT_TEMPLATE_LABELS[filename];
  if (known) {
    return str(known);
  }
  return filename.replace(/\.html$/, "").replace(/_/g, " ");
}
