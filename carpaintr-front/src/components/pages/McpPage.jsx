import { useCallback, useEffect, useState } from 'react';
import { Button, Checkbox, Input, Message, Panel } from 'rsuite';
import TopBarUser from '../layout/TopBarUser';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import { mcpApi } from '../../utils/mcpApi';

registerTranslations('ua', {
  'Connect AI assistants': 'Підключення AI-асистентів',
  'Add this MCP URL in your assistant and sign in with Autolab.': 'Додайте це MCP-посилання в асистенті та увійдіть через Autolab.',
  'API keys for developer clients': 'API-ключі для інструментів розробника',
  'Copy': 'Копіювати',
  'Key name': 'Назва ключа', 'Create API key': 'Створити API-ключ',
  'Copy this key now. It is displayed only once.': 'Скопіюйте ключ зараз. Він показується лише один раз.',
  'Revoke access': 'Відкликати доступ', 'Connected assistants': 'Підключені асистенти',
  'Anyone with a shared PDF link can download it for 30 days.': 'Кожен, хто має посилання на PDF, може завантажити його протягом 30 днів.',
  'Read company information': 'Читати дані компанії', 'Change company rates': 'Змінювати ставки компанії',
  'Read calculations': 'Читати розрахунки', 'Create and edit calculations': 'Створювати та редагувати розрахунки',
  'Publish PDF links': 'Публікувати посилання на PDF', 'API key': 'API-ключ',
});
const scopeLabels = {
  'company:read': 'Read company information', 'company:write': 'Change company rates',
  'calculations:read': 'Read calculations', 'calculations:write': 'Create and edit calculations', 'pdfs:publish': 'Publish PDF links',
};
const McpPage = () => {
  const { str } = useLocale();
  const [data, setData] = useState(null);
  const [connections, setConnections] = useState([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState(Object.keys(scopeLabels));
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [keys, clients] = await Promise.all([mcpApi('/api/v1/mcp/keys'), mcpApi('/api/v1/mcp/connections')]);
    setData(keys); setConnections(clients);
  }, []);
  useEffect(() => { load().catch(e => setError(e.message)); }, [load]);
  const act = async operation => {
    setError(''); setBusy(true);
    try { await operation(); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <><TopBarUser /><main style={{ maxWidth: 800, padding: 16, margin: 'auto' }} data-testid="mcp-page">
    <h1>{str('Connect AI assistants')}</h1>
    {error && <Message type="error" showIcon>{error}</Message>}
    <p>{str('Add this MCP URL in your assistant and sign in with Autolab.')}</p>
    <code data-testid="mcp-url" style={{ overflowWrap: 'anywhere' }}>{data?.mcp_url}</code>
    <p>{str('Anyone with a shared PDF link can download it for 30 days.')}</p>
    <Panel bordered header={str('API keys for developer clients')}>
      <label htmlFor="mcp-key-name">{str('Key name')}</label>
      <Input id="mcp-key-name" data-testid="mcp-key-name" value={name} onChange={setName} maxLength={120} />
      {Object.entries(scopeLabels).map(([scope, label]) => <Checkbox key={scope} data-testid={`mcp-scope-${scope}`} checked={scopes.includes(scope)} onChange={(_, checked) => setScopes(current => checked ? [...current, scope] : current.filter(s => s !== scope))}>{str(label)}</Checkbox>)}
      <Button data-testid="mcp-create-key" appearance="primary" loading={busy} disabled={!name.trim() || !scopes.length} onClick={() => act(async () => {
        const created = await mcpApi('/api/v1/mcp/keys', { method: 'POST', body: { name, scopes } }); setSecret(created.key);
      })}>{str('Create API key')}</Button>
      {secret && <Message type="warning"><p>{str('Copy this key now. It is displayed only once.')}</p><Input readOnly data-testid="mcp-new-key" aria-label={str('API key')} value={secret} /><Button data-testid="mcp-copy-key" onClick={() => navigator.clipboard.writeText(secret).catch(e => setError(e.message))}>{str('Copy')}</Button></Message>}
      {(data?.keys ?? []).map(key => <p key={key.id}>{key.name} <Button data-testid={`mcp-revoke-key-${key.id}`} disabled={busy} onClick={() => act(() => mcpApi(`/api/v1/mcp/keys/${key.id}`, { method: 'DELETE' }))}>{str('Revoke access')}</Button></p>)}
    </Panel>
    <Panel header={str('Connected assistants')}>{connections.map(client => <p key={client.id}>{client.name} <Button data-testid={`mcp-revoke-client-${client.id}`} disabled={busy} onClick={() => act(() => mcpApi(`/api/v1/mcp/connections/${client.id}`, { method: 'DELETE' }))}>{str('Revoke access')}</Button></p>)}</Panel>
  </main></>;
};
export default McpPage;
