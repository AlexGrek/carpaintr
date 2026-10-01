import { useLocale } from "../../localization/LocaleContext";
import { BASE_RATE_ID } from "../../calc/normRates";

// Native select keeps the long list inexpensive on phones and accessible.
export default function NormRatePicker({ rates, value, onChange, label, testId }) {
  const { str } = useLocale();
  if (!rates) return null;
  const selected = value === BASE_RATE_ID || rates.additional.some((rate) => rate.id === value) ? value : "";
  return (
    <label className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span>{str(label)}</span>
      <select value={selected} onChange={(event) => onChange(event.target.value || null)}
        className="max-w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
        data-testid={testId}>
        <option value="">{str("Use inherited labor rate")}</option>
        <option value={BASE_RATE_ID}>{str("Base labor rate")} — {rates.base} {rates.currency}</option>
        {rates.additional.map((rate) => (
          <option key={rate.id} value={rate.id}>{rate.name} — {rate.amount} {rates.currency}</option>
        ))}
      </select>
    </label>
  );
}
