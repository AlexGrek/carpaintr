import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Loader, Message } from 'rsuite';
import { Bot, Building2, Calculator, FilePenLine, FileText, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useLocale, registerTranslations } from '../../localization/LocaleContext';
import { mcpApi } from '../../utils/mcpApi';

registerTranslations('ua', {
  'Connect an AI assistant': 'Підключення AI-асистента',
  'wants to connect to your Autolab account.': 'запитує доступ до вашого облікового запису Autolab.',
  'Requested permissions': 'Запитувані дозволи',
  'Read company information': 'Читати дані компанії',
  'View company details, currency and hourly rates.': 'Переглядати дані компанії, валюту та погодинні ставки.',
  'Change company rates': 'Змінювати ставки компанії',
  'Update the default hourly rates for future calculations.': 'Оновлювати погодинні ставки для майбутніх розрахунків.',
  'Read calculations': 'Читати розрахунки',
  'View saved estimates and browse the calculation catalog.': 'Переглядати збережені кошториси та каталог розрахунків.',
  'Create and edit calculations': 'Створювати та редагувати розрахунки',
  'Build estimates, adjust selected work and set calculation rates.': 'Створювати кошториси, змінювати роботи та ставки розрахунку.',
  'Publish public PDF links': 'Публікувати відкриті посилання на PDF',
  'Save PDFs and create links that open without signing in.': 'Зберігати PDF та створювати посилання, доступні без входу.',
  'You can revoke access anytime in AI assistants.': 'Ви можете відкликати доступ у розділі «AI-асистенти» будь-коли.',
  'Allow access': 'Дозволити доступ',
  'Deny access': 'Відмовити в доступі',
  'Connection details': 'Деталі підключення',
  'Callback address': 'Адреса повернення',
  'Loading request…': 'Завантаження запиту…',
  'Authorization request is missing.': 'Відсутній запит авторизації.',
});

const permissions = {
  'company:read': { icon: Building2, title: 'Read company information', description: 'View company details, currency and hourly rates.' },
  'company:write': { icon: SlidersHorizontal, title: 'Change company rates', description: 'Update the default hourly rates for future calculations.' },
  'calculations:read': { icon: Calculator, title: 'Read calculations', description: 'View saved estimates and browse the calculation catalog.' },
  'calculations:write': { icon: FilePenLine, title: 'Create and edit calculations', description: 'Build estimates, adjust selected work and set calculation rates.' },
  'pdfs:publish': { icon: FileText, title: 'Publish public PDF links', description: 'Save PDFs and create links that open without signing in.' },
};

const McpAuthorizePage = () => {
  const { str } = useLocale();
  const location = useLocation();
  const request = new URLSearchParams(location.search).get('request');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    if (request) {
      mcpApi('/api/v1/mcp/authorize', { method: 'POST', body: { request } })
        .then(result => { if (active) setData(result); })
        .catch(e => { if (active) setError(e.message); });
    }
    return () => { active = false; };
  }, [request]);

  const decide = async decision => {
    setBusy(true);
    setError('');
    try {
      const result = await mcpApi('/api/v1/mcp/authorize', { method: 'POST', body: { request, decision } });
      window.location.assign(result.redirect);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <main
      data-testid="mcp-authorize-page"
      style={{ minHeight: '100svh', padding: 'clamp(24px, 5vw, 64px) 16px', textAlign: 'left', fontSize: 14, lineHeight: 1.5, color: '#25313c', background: '#f5f6f8' }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="mb-6 flex justify-center">
          <Link data-testid="mcp-brand" to="/app/dashboard" style={{ color: '#25313c', fontFamily: 'nunito, sans-serif', fontSize: 26, fontWeight: 800, textDecoration: 'none' }}>
            auto<span style={{ color: '#ce4828' }}>lab</span>
          </Link>
        </div>
        <section
          aria-labelledby="mcp-consent-title"
          style={{ padding: 'clamp(20px, 4vw, 32px)', borderRadius: 20, border: '1px solid #e2e6eb', background: '#fff', boxShadow: '0 8px 32px rgba(30, 41, 59, 0.05)' }}
        >
          <div className="mb-5 flex items-center gap-3">
            <div aria-hidden="true" className="flex shrink-0 items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, background: '#fff1eb', color: '#ce4828' }}>
              <Bot size={24} strokeWidth={1.7} />
            </div>
            <h1 id="mcp-consent-title" style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.4px' }}>
              {str('Connect an AI assistant')}
            </h1>
          </div>

          {(error || !request) && <Message type="error" showIcon style={{ marginBottom: 16 }}>{error || str('Authorization request is missing.')}</Message>}
          {request && !data && !error && <Loader content={str('Loading request…')} />}

          {data && <>
            <p style={{ margin: '0 0 24px', color: '#66717e', overflowWrap: 'anywhere' }}>
              <strong style={{ color: '#25313c', fontWeight: 650 }}>{data.client_name}</strong>{' '}{str('wants to connect to your Autolab account.')}
            </p>
            <section aria-labelledby="mcp-permissions-title">
              <h2 id="mcp-permissions-title" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 650, lineHeight: 1.5 }}>
                {str('Requested permissions')}
              </h2>
              <ul data-testid="mcp-permissions" style={{ margin: 0, padding: 0, listStyle: 'none', border: '1px solid #e7eaee', borderRadius: 12, overflow: 'hidden', background: '#fafbfc' }}>
                {data.scopes.split(/\s+/).filter(Boolean).map((scope, index, scopes) => {
                  const permission = permissions[scope];
                  const Icon = permission?.icon ?? ShieldCheck;
                  return (
                    <li key={scope} className="flex items-start gap-3" style={{ padding: '13px 14px', borderBottom: index < scopes.length - 1 ? '1px solid #e7eaee' : undefined }}>
                      <Icon aria-hidden="true" size={19} strokeWidth={1.7} style={{ flexShrink: 0, marginTop: 2, color: '#73808d' }} />
                      <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        <div style={{ fontWeight: 600 }}>{str(permission?.title ?? scope)}</div>
                        {permission && <p style={{ margin: '3px 0 0', fontSize: 13, lineHeight: 1.5, color: '#66717e' }}>{str(permission.description)}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
            <p className="flex items-start gap-2" style={{ margin: '18px 0 24px', fontSize: 12, lineHeight: 1.6, color: '#66717e' }}>
              <ShieldCheck aria-hidden="true" size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{str('You can revoke access anytime in AI assistants.')}</span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button data-testid="mcp-approve" appearance="primary" disabled={busy} loading={busy} className="flex-1" style={{ minHeight: 44, borderRadius: 10, fontSize: 14, fontWeight: 600 }} onClick={() => decide('approve')}>
                {str('Allow access')}
              </Button>
              <Button data-testid="mcp-deny" disabled={busy} className="flex-1" style={{ minHeight: 44, borderRadius: 10, fontSize: 14, fontWeight: 600, background: '#fff', border: '1px solid #dfe4e9', color: '#46515e' }} onClick={() => decide('deny')}>
                {str('Deny access')}
              </Button>
            </div>
            <details data-testid="mcp-connection-details" style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid #edf0f3', fontSize: 12, color: '#66717e' }}>
              <summary data-testid="mcp-connection-toggle" style={{ cursor: 'pointer', width: 'fit-content', padding: '4px 0' }}>{str('Connection details')}</summary>
              <div style={{ marginTop: 10 }}>
                <div style={{ marginBottom: 4 }}>{str('Callback address')}</div>
                <code data-testid="mcp-callback-address" style={{ display: 'block', overflowWrap: 'anywhere', fontSize: 12, color: '#46515e', background: '#f5f6f8', borderRadius: 6, padding: 10 }}>{data.redirect_uri}</code>
              </div>
            </details>
          </>}
        </section>
      </div>
    </main>
  );
};
export default McpAuthorizePage;
