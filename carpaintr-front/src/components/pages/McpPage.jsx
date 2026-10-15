import { useCallback, useEffect, useState } from 'react';
import { Button, Checkbox, Input, Message, Panel } from 'rsuite';
import { Check, Clipboard, ExternalLink, KeyRound, Sparkles } from 'lucide-react';
import TopBarUser from '../layout/TopBarUser';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import { mcpApi } from '../../utils/mcpApi';
import './McpPage.css';

registerTranslations('ua', {
  'Connect AI assistants': 'Підключення AI-асистентів',
  'Connect Autolab to your AI assistant': 'Підключіть Autolab до вашого AI-асистента',
  'Use your assistant to build estimates, explore your catalogue, and prepare documents with your Autolab data.': 'Використовуйте асистента, щоб створювати розрахунки, переглядати каталог і готувати документи з даними Autolab.',
  'Connect in three steps': 'Підключення за три кроки',
  'Open your assistant settings': 'Відкрийте налаштування асистента',
  'Find the section for connectors, integrations, or MCP servers.': 'Знайдіть розділ для конекторів, інтеграцій або MCP-серверів.',
  'Add the Autolab server': 'Додайте сервер Autolab',
  'Paste this URL as a remote MCP server using Streamable HTTP.': 'Вставте цю адресу як віддалений MCP-сервер через Streamable HTTP.',
  'Sign in and allow access': 'Увійдіть і дозвольте доступ',
  'Your assistant opens Autolab so you can review and approve its requested permissions.': 'Асистент відкриє Autolab, де ви зможете переглянути й підтвердити запитувані дозволи.',
  'Copied': 'Скопійовано',
  'Try asking your assistant': 'Спробуйте запитати асистента',
  'Example prompts': 'Приклади запитів',
  'Create an estimate for repairing and painting the front bumper of a 2020 Toyota Corolla.': 'Створи розрахунок ремонту та фарбування переднього бампера Toyota Corolla 2020 року.',
  'Find the repair operations and materials for a scratched rear door.': 'Знайди ремонтні операції та матеріали для задніх дверей із подряпинами.',
  'Review my latest estimate and prepare a PDF for the customer.': 'Переглянь мій останній розрахунок і підготуй PDF для клієнта.',
  'API keys for developer clients': 'API-ключі для інструментів розробника',
  'Use an API key only with a client that supports a Bearer token.': 'Використовуйте API-ключ лише з клієнтом, який підтримує Bearer-токен.',
  'Key name': 'Назва ключа',
  'Create API key': 'Створити API-ключ',
  'Copy this key now. It is displayed only once.': 'Скопіюйте ключ зараз. Він показується лише один раз.',
  'Revoke access': 'Відкликати доступ',
  'Connected assistants': 'Підключені асистенти',
  'No assistants are connected yet.': 'Ще немає підключених асистентів.',
  'No API keys yet.': 'Ще немає API-ключів.',
  'Anyone with a shared PDF link can download it for 30 days.': 'Кожен, хто має посилання на PDF, може завантажити його протягом 30 днів.',
  'Read company information': 'Читати дані компанії',
  'Change company rates': 'Змінювати ставки компанії',
  'Read calculations': 'Читати розрахунки',
  'Create and edit calculations': 'Створювати та редагувати розрахунки',
  'Publish PDF links': 'Публікувати посилання на PDF',
  'API key': 'API-ключ',
});

const scopeLabels = {
  'company:read': 'Read company information',
  'company:write': 'Change company rates',
  'calculations:read': 'Read calculations',
  'calculations:write': 'Create and edit calculations',
  'pdfs:publish': 'Publish PDF links',
};

const promptKeys = [
  'Create an estimate for repairing and painting the front bumper of a 2020 Toyota Corolla.',
  'Find the repair operations and materials for a scratched rear door.',
  'Review my latest estimate and prepare a PDF for the customer.',
];

const McpPage = () => {
  const { str } = useLocale();
  const [data, setData] = useState(null);
  const [connections, setConnections] = useState([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState(Object.keys(scopeLabels));
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const [keys, clients] = await Promise.all([
      mcpApi('/api/v1/mcp/keys'),
      mcpApi('/api/v1/mcp/connections'),
    ]);
    setData(keys);
    setConnections(clients);
  }, []);

  useEffect(() => {
    load().catch((loadError) => setError(loadError.message));
  }, [load]);

  const copyText = async (value, target) => {
    setError('');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
    } catch (copyError) {
      setError(copyError.message);
    }
  };

  const act = async (operation) => {
    setError('');
    setBusy(true);
    try {
      await operation();
      await load();
    } catch (operationError) {
      setError(operationError.message);
    } finally {
      setBusy(false);
    }
  };

  const copyButton = (value, target, testId, compact = false) => (
    <Button
      data-testid={testId}
      appearance={compact ? 'subtle' : 'default'}
      className={compact ? 'mcp-copy-button-compact' : 'mcp-copy-button'}
      disabled={!value}
      onClick={() => copyText(value, target)}
    >
      {copied === target ? <Check size={16} aria-hidden="true" /> : <Clipboard size={16} aria-hidden="true" />}
      {copied === target ? str('Copied') : str('Copy')}
    </Button>
  );

  return (
    <>
      <TopBarUser />
      <main className="mcp-page" data-testid="mcp-page">
        <section className="mcp-hero" aria-labelledby="mcp-page-title">
          <img
            className="mcp-logo"
            src="https://modelcontextprotocol.io/logo/light.svg"
            alt="Model Context Protocol"
          />
          <div>
            <p className="mcp-eyebrow">MODEL CONTEXT PROTOCOL</p>
            <h1 id="mcp-page-title">{str('Connect Autolab to your AI assistant')}</h1>
            <p className="mcp-intro">{str('Use your assistant to build estimates, explore your catalogue, and prepare documents with your Autolab data.')}</p>
          </div>
        </section>

        {error && <Message className="mcp-message" type="error" showIcon>{error}</Message>}

        <section aria-labelledby="mcp-setup-title">
          <h2 id="mcp-setup-title" className="mcp-section-title">{str('Connect in three steps')}</h2>
          <div className="mcp-steps">
            <article className="mcp-step">
              <span className="mcp-step-number">1</span>
              <h3>{str('Open your assistant settings')}</h3>
              <p>{str('Find the section for connectors, integrations, or MCP servers.')}</p>
            </article>
            <article className="mcp-step">
              <span className="mcp-step-number">2</span>
              <h3>{str('Add the Autolab server')}</h3>
              <p>{str('Paste this URL as a remote MCP server using Streamable HTTP.')}</p>
            </article>
            <article className="mcp-step">
              <span className="mcp-step-number">3</span>
              <h3>{str('Sign in and allow access')}</h3>
              <p>{str('Your assistant opens Autolab so you can review and approve its requested permissions.')}</p>
            </article>
          </div>

          <div className="mcp-url-card">
            <div>
              <p className="mcp-url-label">MCP server URL</p>
              <code data-testid="mcp-url">{data?.mcp_url || '…'}</code>
            </div>
            {copyButton(data?.mcp_url || '', 'url', 'mcp-copy-url')}
          </div>
        </section>

        <section className="mcp-prompts" aria-labelledby="mcp-prompts-title">
          <div className="mcp-prompts-heading">
            <Sparkles size={20} aria-hidden="true" />
            <div>
              <p className="mcp-eyebrow">{str('Try asking your assistant')}</p>
              <h2 id="mcp-prompts-title">{str('Example prompts')}</h2>
            </div>
          </div>
          <div className="mcp-prompt-list">
            {promptKeys.map((prompt, index) => (
              <div className="mcp-prompt" key={prompt}>
                <p>“{str(prompt)}”</p>
                {copyButton(str(prompt), `prompt-${index}`, `mcp-copy-prompt-${index}`, true)}
              </div>
            ))}
          </div>
        </section>

        <div className="mcp-management">
          <Panel bordered header={<span className="mcp-panel-title"><KeyRound size={18} aria-hidden="true" />{str('API keys for developer clients')}</span>}>
            <p className="mcp-panel-description">{str('Use an API key only with a client that supports a Bearer token.')}</p>
            <label htmlFor="mcp-key-name">{str('Key name')}</label>
            <Input id="mcp-key-name" data-testid="mcp-key-name" value={name} onChange={setName} maxLength={120} />
            <div className="mcp-scopes">
              {Object.entries(scopeLabels).map(([scope, label]) => (
                <Checkbox key={scope} data-testid={`mcp-scope-${scope}`} checked={scopes.includes(scope)} onChange={(_, checked) => setScopes((current) => checked ? [...current, scope] : current.filter((item) => item !== scope))}>
                  {str(label)}
                </Checkbox>
              ))}
            </div>
            <Button data-testid="mcp-create-key" appearance="primary" loading={busy} disabled={!name.trim() || !scopes.length} onClick={() => act(async () => {
              const created = await mcpApi('/api/v1/mcp/keys', { method: 'POST', body: { name, scopes } });
              setSecret(created.key);
            })}>{str('Create API key')}</Button>
            {secret && <Message className="mcp-new-key" type="warning"><p>{str('Copy this key now. It is displayed only once.')}</p><Input readOnly data-testid="mcp-new-key" aria-label={str('API key')} value={secret} />{copyButton(secret, 'key', 'mcp-copy-key')}</Message>}
            <div className="mcp-access-list">
              {(data?.keys ?? []).length ? data.keys.map((key) => <div className="mcp-access-row" key={key.id}><span>{key.name}</span><Button data-testid={`mcp-revoke-key-${key.id}`} disabled={busy} onClick={() => act(() => mcpApi(`/api/v1/mcp/keys/${key.id}`, { method: 'DELETE' }))}>{str('Revoke access')}</Button></div>) : <p>{str('No API keys yet.')}</p>}
            </div>
          </Panel>

          <Panel bordered header={str('Connected assistants')}>
            <p className="mcp-panel-description">{str('Anyone with a shared PDF link can download it for 30 days.')}</p>
            <div className="mcp-access-list">
              {connections.length ? connections.map((client) => <div className="mcp-access-row" key={client.id}><span>{client.name}</span><Button data-testid={`mcp-revoke-client-${client.id}`} disabled={busy} onClick={() => act(() => mcpApi(`/api/v1/mcp/connections/${client.id}`, { method: 'DELETE' }))}>{str('Revoke access')}</Button></div>) : <p>{str('No assistants are connected yet.')}</p>}
            </div>
          </Panel>
        </div>

        <a className="mcp-doc-link" data-testid="mcp-official-site" href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">
          Model Context Protocol <ExternalLink size={15} aria-hidden="true" />
        </a>
      </main>
    </>
  );
};

export default McpPage;
