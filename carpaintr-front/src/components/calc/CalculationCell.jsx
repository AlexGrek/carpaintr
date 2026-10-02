import { Button, Input } from 'rsuite';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import { numericFields, parseCell } from '../../calc/calculationDocument';
registerTranslations('ua', {
  'Reset all edited cells': 'Скинути всі змінені клітинки',
  'Reset to default': 'Повернути типове значення',
  'Edited': 'Змінено',
  'Enter a finite number': 'Введіть скінченне число',
  'More row fields': 'Інші поля рядка',
  'Include in document': 'Додати до документа',
  'Source values for this calculation': 'Вихідні значення для цього розрахунку',
  'Calculated total': 'Обчислений підсумок',
  'Refresh calculation defaults': 'Оновити типові значення розрахунку',
  'Saved edits for inactive rows': 'Збережені зміни неактивних рядків',
  'Restore row': 'Відновити рядок',
  'Undo last change': 'Скасувати останню зміну',
  'Fix invalid cells before generating a document': 'Виправте некоректні клітинки перед створенням документа',
});
export default function CalculationCell({ entity, field, value, drafts, onEdit, onReset, testId, label, onFocus, onBlur }) {
  const { str } = useLocale();
  const draft = drafts?.[entity.id]?.[field];
  const text = draft ?? (value == null ? '' : String(value));
  const invalid = parseCell(text, numericFields.has(field)).error;
  const edited = entity._overrides?.includes(field);
  if (!onEdit) return <span>{value == null ? '' : String(value)}</span>;
  return <div className="flex items-center gap-1" style={{ minWidth: numericFields.has(field) ? 84 : 120 }}>
    <Input value={text} onChange={value => onEdit(entity.id, field, value)} size="sm"
      onFocus={() => onFocus?.(entity.id, field)} onBlur={() => onBlur?.(entity.id, field)}
      aria-label={str(label ?? field)} aria-invalid={!!invalid} title={invalid ? str(invalid) : edited ? str('Edited') : undefined}
      data-testid={testId ?? `calc-cell-${entity.id}-${field}`}
      style={invalid ? { borderColor: '#dc2626' } : edited ? { borderColor: '#f59e0b' } : {}} />
    {(edited || draft !== undefined) && onReset && <Button size="xs" appearance="subtle" onClick={() => onReset(entity.id, field)}
      aria-label={str('Reset to default')} title={str('Reset to default')} data-testid={`calc-reset-${entity.id}-${field}`}>↺</Button>}
  </div>;
}
