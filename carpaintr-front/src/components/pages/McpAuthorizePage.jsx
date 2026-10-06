import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Message, Panel } from 'rsuite';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import TopBarUser from '../layout/TopBarUser';
import { mcpApi } from '../../utils/mcpApi';

registerTranslations('ua', {
  'Authorize an AI assistant': 'Дозвіл для AI-асистента',
  'This assistant requests access to your Autolab account.': 'Цей асистент запитує доступ до вашого облікового запису Autolab.',
  'Allow access': 'Дозволити доступ', 'Deny access': 'Відмовити в доступі',
  'Callback address': 'Адреса повернення', 'Authorization request is missing.': 'Відсутній запит авторизації.',
});
const permissionLabels = { 'company:read': ['Read company information', 'Читати дані компанії'], 'company:write': ['Change company rates', 'Змінювати ставки компанії'], 'calculations:read': ['Read calculations', 'Читати розрахунки'], 'calculations:write': ['Create and edit calculations', 'Створювати та редагувати розрахунки'], 'pdfs:publish': ['Publish public PDF links', 'Публікувати відкриті посилання на PDF'] };
const McpAuthorizePage = () => {
  const { str, currentLang } = useLocale();
  const location = useLocation();
  const request = new URLSearchParams(location.search).get('request');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (request) mcpApi('/api/v1/mcp/authorize', { method: 'POST', body: { request } }).then(result => { if (active) setData(result); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [request]);
  const decide = async decision => {
    setBusy(true); setError('');
    try {
      const result = await mcpApi('/api/v1/mcp/authorize', { method: 'POST', body: { request, decision } });
      window.location.assign(result.redirect);
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return <><TopBarUser /><main style={{ maxWidth: 650, margin: 'auto', padding: 16 }} data-testid="mcp-authorize-page">
    <h1>{str('Authorize an AI assistant')}</h1>
    {(error || !request) && <Message type="error">{error || str('Authorization request is missing.')}</Message>}
    {data && <Panel bordered header={data.client_name}>
      <p>{str('This assistant requests access to your Autolab account.')}</p>
      <ul>{data.scopes.split(' ').map(scope => <li key={scope}>{permissionLabels[scope]?.[currentLang === 'en' ? 0 : 1] ?? scope}</li>)}</ul>
      <p style={{ overflowWrap: 'anywhere' }}>{str('Callback address')}: {data.redirect_uri}</p>
      <Button data-testid="mcp-approve" appearance="primary" loading={busy} onClick={() => decide('approve')}>{str('Allow access')}</Button>{' '}
      <Button data-testid="mcp-deny" disabled={busy} onClick={() => decide('deny')}>{str('Deny access')}</Button>
    </Panel>}
  </main></>;
};
export default McpAuthorizePage;
