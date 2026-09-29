/**
 * White card with a small uppercase section label — matches the card style
 * used by the body-parts and final calc stages. `action` renders at the
 * right of the header (e.g. a close button).
 */
const StageSection = ({
  icon: Icon,
  title,
  action,
  children,
  className = "",
  testId,
}) => (
  <div
    className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm ${className}`}
    data-testid={testId}
  >
    {(title || action) && (
      <div className="mb-3 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {Icon && <Icon size={14} />}
          {title}
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
);

export default StageSection;
