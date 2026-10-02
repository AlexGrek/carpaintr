import { Button, Input } from 'rsuite';
import { useLocale } from '../../localization/LocaleContext';
export default function LookupTableEditor({ tables, overrides, onChange, onReset }) {
  const { str } = useLocale();
  return <details className="rounded-xl border border-slate-200 p-3" data-testid="calc-lookup-editor">
    <summary>{str('Source values for this calculation')}</summary>
    {tables.filter(table => table.data).map(table => <details key={table.name} className="mt-2">
      <summary>{table.name}</summary>
      {Object.entries(table.data).map(([field, value]) => <label key={field} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="flex-1">{field}</span>
        <Input size="sm" value={overrides?.[table.name]?.[field] ?? value ?? ''} onChange={value => onChange(table.name, field, value)}
          style={{ width: 130 }} aria-label={`${table.name}: ${field}`} data-testid={`calc-lookup-${table.name}-${field}`} />
      {Object.hasOwn(overrides?.[table.name] ?? {}, field) && <Button size="xs" appearance="subtle" onClick={() => onReset(table.name, field)} aria-label={str('Reset to default')} data-testid={`calc-lookup-reset-${table.name}-${field}`}>↺</Button>}
      </label>)}
    </details>)}
  </details>;
}
