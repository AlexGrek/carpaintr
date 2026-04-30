import { Message, Divider } from 'rsuite';

function tableToPath(name) {
    return `tables/${name}.csv`;
}

const TABLE_CHIP_STYLE = {
    fontSize: '10px',
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    borderRadius: '3px',
    padding: '1px 5px',
    textDecoration: 'none',
    fontFamily: 'monospace',
};

const FS_BADGE_BASE = {
    fontSize: '10px',
    padding: '1px 4px',
    borderRadius: '3px',
    textDecoration: 'none',
};

const PRE_STYLE = {
    background: '#f5f5f5',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    overflow: 'auto',
    maxHeight: '200px',
};

const ProcessorLogEntry = ({ log, getEditorUrl }) => {
    const bg =
        log.status === 'applied' ? '#f0fdf4' :
        log.status === 'error'   ? '#fef2f2' :
        '#f3f4f6';
    const color =
        log.status === 'applied' ? '#166534' :
        log.status === 'error'   ? '#dc2626' :
        '#6b7280';
    const icon = log.status === 'applied' ? '✅' : log.status === 'error' ? '❌' : '⏭';

    return (
        <div style={{ padding: '3px 6px', marginBottom: '2px', borderRadius: '3px', backgroundColor: bg, color }}>
            <span style={{ marginRight: '6px' }}>{icon}</span>
            <strong>{log.processorName || '(unnamed)'}</strong>
            <a
                href="/app/fileeditor?fs=User&path=procs"
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...FS_BADGE_BASE, marginLeft: '5px', backgroundColor: '#dbeafe', color: '#1d4ed8' }}
                title="Open procs in User fs"
            >U</a>
            <a
                href="/app/fileeditor?fs=Common&path=procs"
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...FS_BADGE_BASE, marginLeft: '3px', backgroundColor: '#f3f4f6', color: '#374151' }}
                title="Open procs in Common fs"
            >C</a>
            {log.category && (
                <span style={{ opacity: 0.6, marginLeft: '6px', fontWeight: 'normal' }}>
                    [{log.category}#{log.orderingNum}]
                </span>
            )}
            <span style={{ marginLeft: '8px', fontWeight: 'normal', opacity: 0.9 }}>{log.detail}</span>
            {log.tables && log.tables.length > 0 && (
                <div style={{ marginLeft: '28px', marginTop: '3px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {log.tables.map((tbl, ti) => (
                        <a
                            key={ti}
                            href={getEditorUrl(tableToPath(tbl))}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={TABLE_CHIP_STYLE}
                        >
                            {tbl}
                        </a>
                    ))}
                </div>
            )}
            {log.rows && log.rows.length > 0 && (
                <div style={{ marginLeft: '28px', marginTop: '2px' }}>
                    {log.rows.map((row, ri) => (
                        <div key={ri} style={{ fontSize: '10px', color: '#374151' }}>
                            ↳ {row.name}: <strong>{row.estimation}</strong>
                            {row.tooltip && (
                                <span style={{ opacity: 0.5, marginLeft: '4px' }}>({row.tooltip})</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const PartDebugPanel = ({ logs, open, onToggle, getEditorUrl }) => (
    <>
        <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
                onClick={onToggle}
                style={{
                    width: '20px', height: '20px', fontSize: '12px',
                    border: '1px solid #d1d5db', borderRadius: '50%',
                    backgroundColor: open ? '#eff6ff' : 'transparent',
                    color: open ? '#3b82f6' : '#9ca3af',
                    cursor: 'pointer', lineHeight: 1, fontWeight: 700, padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="Show processor debug info"
            >?</button>
        </div>
        {open && logs && (
            <div style={{
                marginTop: '8px', borderLeft: '3px solid #d97706',
                backgroundColor: '#fffbeb', borderRadius: '0 4px 4px 0', padding: '8px 10px',
            }}>
                <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600, marginBottom: '6px' }}>
                    🐛&nbsp;
                    {logs.filter(l => l.status === 'applied').length} applied &nbsp;·&nbsp;
                    {logs.filter(l => l.status === 'skipped').length} skipped &nbsp;·&nbsp;
                    {logs.filter(l => l.status === 'error').length} errors
                    &nbsp;({logs.length} total)
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6' }}>
                    {logs.map((log, i) => (
                        <ProcessorLogEntry key={i} log={log} getEditorUrl={getEditorUrl} />
                    ))}
                </div>
            </div>
        )}
    </>
);

export const TechDataPanel = ({
    errors, setErrors,
    body, carClass, selectedParts, partsVisual,
    company, availableParts, availablePartsT2,
    processors, calculations,
    onChange, setCalculations,
}) => (
    <div style={{ textAlign: 'left' }}>
        {errors.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
                {errors.map((err, idx) => (
                    <Message key={idx} type="error" showIcon style={{ marginBottom: '10px' }}>
                        <strong>[{err.context}]</strong> {err.message}
                        <div style={{ fontSize: '11px', marginTop: '5px', fontFamily: 'monospace', opacity: 0.8 }}>
                            {err.timestamp}
                        </div>
                    </Message>
                ))}
            </div>
        )}

        <Divider />
        <h5>Car Configuration</h5>
        <p><strong>Body Type:</strong> {body || 'Not set'}</p>
        <p><strong>Class:</strong> {carClass || 'Not set'}</p>
        <p><strong>Selected Parts:</strong> {selectedParts.length}</p>

        <h5 style={{ marginTop: '20px' }}>Parts Visual Config</h5>
        <ul>
            {Object.keys(partsVisual).map(partKey => (
                <li key={partKey}>
                    {partKey}: {partsVisual[partKey].image || 'no image'}
                    {partsVisual[partKey].mirrored && ' (mirrored)'}
                </li>
            ))}
        </ul>

        <Divider />
        <h5>Fetched Data</h5>

        {[
            ['Company Info', company, JSON.stringify(company, null, 2)],
            [`Available Parts T1 (${availableParts.length})`, availableParts.length > 0, JSON.stringify(availableParts, null, 2)],
            [`Available Parts T2 (${availablePartsT2.length})`, availablePartsT2.length > 0, JSON.stringify(availablePartsT2, null, 2)],
            [`Processors (${processors.length})`, processors.length > 0, JSON.stringify(processors, null, 2)],
        ].map(([label, ok, content]) => (
            <details key={label} style={{ marginBottom: '15px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '5px' }}>
                    {label} {ok && '✓'}
                </summary>
                <pre style={PRE_STYLE}>{content}</pre>
            </details>
        ))}

        <Divider />
        <h5>Calculations</h5>
        <pre style={PRE_STYLE}>{JSON.stringify(calculations, null, 2)}</pre>

        <div style={{ marginTop: '20px' }}>
            <button onClick={() => onChange && onChange(['test_part'])} style={{ marginRight: '10px' }}>
                Test onChange
            </button>
            <button onClick={() => setCalculations && setCalculations({ test: 'value' })}>
                Test setCalculations
            </button>
            <button onClick={() => setErrors([])} style={{ marginLeft: '10px' }} disabled={errors.length === 0}>
                Clear Errors ({errors.length})
            </button>
        </div>
    </div>
);
