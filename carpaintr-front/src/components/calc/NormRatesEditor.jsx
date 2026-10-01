import { Button, Input, InputNumber } from "rsuite";
import { registerTranslations, useLocale } from "../../localization/LocaleContext";

registerTranslations("ua", {
  "Labor rates": "Ціни нормогодини",
  "Base labor rate": "Базова нормогодина",
  "Add labor rate": "Додати нормогодину",
  "Labor rate name": "Назва нормогодини",
  "Labor rate currency": "Валюта нормогодини",
  "Remove labor rate": "Видалити нормогодину",
  "Additional labor rate": "Додаткова нормогодина",
  "Part labor rate": "Нормогодина для деталі",
  "Table labor rate": "Нормогодина для таблиці",
  "Use inherited labor rate": "Успадкувати нормогодину",
  "Base rate is 0. Select or configure a labor rate to price work.":
    "Базова нормогодина дорівнює 0. Оберіть або задайте нормогодину для розрахунку вартості робіт.",
});

const nonNegativeAmount = (value) => {
  const amount = Number(String(value).replace(",", "."));
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

export default function NormRatesEditor({ value, onChange, currencyEditable = false, testId = "norm-rates" }) {
  const { str } = useLocale();
  if (!value) return null;
  const updateRate = (id, patch) => onChange({
    ...value,
    additional: value.additional.map((rate) => rate.id === id ? { ...rate, ...patch } : rate),
  });
  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left" data-testid={testId}>
      <div className="mb-3 font-semibold">{str("Labor rates")} {value.currency && `(${value.currency})`}</div>
      {currencyEditable && <label className="mb-3 flex items-center gap-2">
        <span>{str("Labor rate currency")}</span>
        <Input value={value.currency} onChange={(currency) => onChange({ ...value, currency })}
          aria-label={str("Labor rate currency")} data-testid={`${testId}-currency`} style={{ width: 130 }} />
      </label>}
      <label className="mb-3 flex flex-wrap items-center gap-2">
        <span className="min-w-32 flex-1">{str("Base labor rate")}</span>
        <InputNumber min={0} step={0.01} value={value.base} onChange={(base) => onChange({ ...value, base: nonNegativeAmount(base) })}
          aria-label={str("Base labor rate")} data-testid={`${testId}-base`} style={{ width: 130 }} />
      </label>
      {value.additional.map((rate, index) => (
        <div key={rate.id} className="mb-3 flex flex-wrap items-center gap-2">
          <Input value={rate.name} onChange={(name) => updateRate(rate.id, { name })}
            placeholder={str("Labor rate name")} aria-label={str("Labor rate name")}
            data-testid={`${testId}-name-${index}`} style={{ flex: "1 1 140px", minWidth: 0 }} />
          <InputNumber min={0} step={0.01} value={rate.amount} onChange={(amount) => updateRate(rate.id, { amount: nonNegativeAmount(amount) })}
            aria-label={str("Norm price")} data-testid={`${testId}-amount-${index}`} style={{ width: 130 }} />
          <Button appearance="subtle" aria-label={str("Remove labor rate")} data-testid={`${testId}-remove-${index}`}
            onClick={() => onChange({ ...value, additional: value.additional.filter((item) => item.id !== rate.id) })}>×</Button>
        </div>
      ))}
      <Button appearance="ghost" size="sm" data-testid={`${testId}-add`} onClick={() => onChange({
        ...value,
        additional: [...value.additional, { id: crypto.randomUUID(), name: str("Additional labor rate"), amount: value.base }],
      })}>{str("Add labor rate")}</Button>
    </section>
  );
}
