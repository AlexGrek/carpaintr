import { useCallback, useEffect, useState } from 'react';
import { Button, Message, Panel } from 'rsuite';
import { useLocale, registerTranslations } from '../localization/LocaleContext';
import { mcpApi, downloadSavedPdf } from '../utils/mcpApi';

registerTranslations('ua', {
  'Saved PDFs': 'Збережені PDF', 'No saved PDFs yet.': 'Збережених PDF ще немає.',
  'Share for another 30 days': 'Нове посилання на 30 днів', 'Revoke PDF link': 'Відкликати посилання PDF',
  'Public link expires': 'Публічне посилання діє до', 'Public link expired or revoked': 'Публічне посилання прострочене або відкликане',
  'Download PDF': 'Завантажити PDF', 'Back': 'Назад', 'Next': 'Далі',
  'Copy PDF link': 'Скопіювати посилання PDF',
});
const SavedPdfList = () => {
  const { str } = useLocale();
  const [pdfs, setPdfs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const load = useCallback(async () => setPdfs(await mcpApi('/api/v1/pdfs')), []);
  useEffect(() => { load().catch(e => setError(e.message)); }, [load]);
  const act = async operation => {
    setBusy(true); setError('');
    try { await operation(); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section data-testid="saved-pdfs"><h2>{str('Saved PDFs')}</h2>
    {error && <Message type="error">{error}</Message>}
    {!pdfs.length && <p>{str('No saved PDFs yet.')}</p>}
    {pdfs.slice(page * 10, page * 10 + 10).map(pdf => <Panel bordered key={pdf.document_id} header={pdf.filename} style={{ marginBottom: 12, overflowWrap: 'anywhere' }}>
      <p>{new Date(pdf.created_at * 1000).toLocaleString()}</p>
      <Button data-testid={`pdf-download-${pdf.document_id}`} disabled={busy} onClick={() => act(() => downloadSavedPdf(pdf.document_id, pdf.filename))}>{str('Download PDF')}</Button>{' '}
      <Button data-testid={`pdf-share-${pdf.document_id}`} disabled={busy} onClick={() => act(() => mcpApi(`/api/v1/pdfs/${pdf.document_id}/share`, { method: 'POST' }))}>{str('Share for another 30 days')}</Button>
      {pdf.public_url ? <>
        <p>{str('Public link expires')}: {new Date(pdf.expires_at * 1000).toLocaleString()}</p>
        <p><a data-testid={`pdf-public-${pdf.document_id}`} href={pdf.public_url} rel="noreferrer">{pdf.public_url}</a></p>
        <Button data-testid={`pdf-copy-${pdf.document_id}`} disabled={busy} onClick={() => navigator.clipboard.writeText(pdf.public_url).catch(e => setError(e.message))}>{str('Copy PDF link')}</Button>{' '}
        <Button data-testid={`pdf-revoke-${pdf.document_id}`} disabled={busy} onClick={() => act(() => mcpApi(`/api/v1/pdfs/${pdf.document_id}/share`, { method: 'DELETE' }))}>{str('Revoke PDF link')}</Button>
      </> : <p>{str('Public link expired or revoked')}</p>}
    </Panel>)}
    <Button data-testid="pdf-previous-page" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{str('Back')}</Button>{' '}
    <Button data-testid="pdf-next-page" disabled={(page + 1) * 10 >= pdfs.length} onClick={() => setPage(p => p + 1)}>{str('Next')}</Button>
  </section>;
};
export default SavedPdfList;
