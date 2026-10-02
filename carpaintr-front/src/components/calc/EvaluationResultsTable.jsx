import { useState } from 'react';
import { Message, Modal } from 'rsuite';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import Trans from '../../localization/Trans';
import CalculationCell from './CalculationCell';
import NormRatePicker from './NormRatePicker';
import { isValidTableEntry, rowSum, toRealNumber } from '../../calc/collapseTables';
import { partScopeId } from '../../calc/calculationDocument';
import './EvaluationResultsTable.css';
registerTranslations('ua', {
  Name: 'Найменування', Part: 'Деталь', Estimation: 'Оцінка', Price: 'Ціна', Sum: 'Сума', Total: 'Всього',
  'Data source': 'Джерело даних', Table: 'Таблиця', Field: 'Поле', 'Ordering': 'Порядок', Tooltip: 'Підказка',
});
const defaultGetEditorUrl = file => `/app/fileeditor?fs=Common&path=${encodeURIComponent(file)}`;
export const EvaluationResultsTable = ({ data, normRates, tableRateOverrides, onTableRateChange, currency = '', basePrice = 1,
  hideTableHeaders = false, showPartColumn = false, getEditorUrl = defaultGetEditorUrl, onCellEdit, onCellReset, onCellFocus, onCellBlur, cellDrafts, setData }) => {
  const { str } = useLocale();
  const [trace, setTrace] = useState(null);
  // The old calc1 renderer remains compatible. Calc2 always dispatches addressed cell edits.
  const legacyEdit = setData ? (id, field, value) => setData(data.map((table, ti) => ({ ...table, ...(id === `legacy-table-${ti}` ? { [field]: value } : {}), result: table.result.map((row, ri) => (row.id ?? `legacy-row-${ti}-${ri}`) === id ? { ...row, [field]: value, sum: field === 'sum' ? value : undefined } : row) }))) : null;
  const edit = onCellEdit ?? legacyEdit;
  const cell = (entity, field, label = field) => <CalculationCell entity={entity} field={field} value={entity[field]}
    onFocus={onCellFocus} onBlur={onCellBlur} drafts={cellDrafts} onEdit={edit} onReset={onCellReset} label={label} />;
  if (!Array.isArray(data)) return <Message type="error">Invalid calculation tables</Message>;
  return <div className="flex flex-col gap-4">
    <Modal open={!!trace} onClose={() => setTrace(null)} size="xs" data-testid="calc-source-modal">
      <Modal.Header><Modal.Title><Trans>Data source</Trans></Modal.Title></Modal.Header>
      <Modal.Body>{trace && <><a href={getEditorUrl(`tables/${trace.table}.csv`)} target="_blank" rel="noopener noreferrer">{trace.table}</a><p>{trace.field}</p></>}</Modal.Body>
    </Modal>
    {data.map((rawEntry, index) => { const entry = onCellEdit ? rawEntry : { ...rawEntry, id: rawEntry.id ?? `legacy-table-${index}`, result: rawEntry.result?.map((row, ri) => ({ ...row, id: row.id ?? `legacy-row-${index}-${ri}` })) }; return !isValidTableEntry(entry) ? <Message type="error" key={index}>{entry?.text ?? 'Invalid table'}</Message> :
      <section key={entry.id ?? index} className="w-full" data-testid={`calc-evaluation-${entry.id ?? index}`}>
        {!hideTableHeaders && <div className="mb-2 font-semibold">{cell(entry, 'name', 'Name')}</div>}
        {edit && onTableRateChange && <NormRatePicker rates={normRates} value={tableRateOverrides?.[entry.id] ?? (data.filter(table => table.name === entry.name).length === 1 ? tableRateOverrides?.[entry.name] : undefined)}
          onChange={id => onTableRateChange(entry.id ?? entry.name, id)} label="Table labor rate" testId={`calc-table-rate-${entry.name}`} />}
        <table className="evaluation-table modern"><thead><tr>
          <th>#</th><th>{str('Name')}</th>{showPartColumn && <th>{str('Part')}</th>}
          <th>{str('Estimation')}</th><th>{str('Unit')}</th><th>{str('Price')} {currency}</th><th>{str('Sum')} {currency}</th>
        </tr></thead><tbody>
          {entry.result.map((row, i) => <tr key={row.id ?? i} data-testid={`calc-row-${row.id}`} data-excluded={row.excluded ? 'true' : undefined}>
            <td>{i + 1}</td><td>
              {cell(row, 'name', 'Name')}
              {row.trace && <button type="button" onClick={() => setTrace(row.trace)} data-testid={`calc-trace-${row.id}`} aria-label={str('Data source')}>ⓘ</button>}
              {edit && <details className="text-xs mt-1" data-testid={`calc-row-options-${row.id}`}><summary>{str('More row fields')}</summary>
                {['category', 'orderingNum', 'tooltip'].map(field => <label key={field} className="block mt-1">{str(field === 'orderingNum' ? 'Ordering' : field === 'tooltip' ? 'Tooltip' : 'Category')}{cell(row, field)}</label>)}
                <label><input type="checkbox" checked={!row.excluded} onChange={event => edit(row.id, 'excluded', !event.target.checked)} data-testid={`calc-include-${row.id}`} />{str('Include in document')}</label>
              </details>}
            </td>{showPartColumn && <td>{cell({ id: partScopeId(row._partKey ?? row.part), name: row.part, _overrides: row._partOverrides }, 'name', 'Part')}</td>}
            <td className="evaluation-table-cell-numeric">{cell(row, 'estimation', 'Estimation')}</td>
            <td>{cell(row, 'unit', 'Unit')}</td>
            <td className="evaluation-table-cell-numeric">{cell(row, 'price', 'Price')}</td>
            <td className="evaluation-table-cell-numeric">{edit ? cell(row, 'sum', 'Sum') : rowSum(row, basePrice).toFixed(2)}</td>
          </tr>)}
          <tr className="total-row"><td colSpan={showPartColumn ? 6 : 5}>{str('Total')}</td><td>
            {edit ? cell(entry, 'total', 'Total') : toRealNumber(entry.total ?? entry.result.reduce((sum,row) => sum + rowSum(row,basePrice),0)).toFixed(2)} {currency}
            {entry._overrides?.includes('total') && <div className="text-xs font-normal">{str('Calculated total')}: {toRealNumber(entry.computedTotal).toFixed(2)}</div>}
          </td></tr>
        </tbody></table>
      </section>; })}
  </div>;
};
