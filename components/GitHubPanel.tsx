import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkGithubToken } from '@/lib/github';
import { describeError } from '@/lib/llm';

const CREATE_URL = 'https://github.com/settings/personal-access-tokens/new';

type Check = { status: 'idle' | 'checking' | 'ok' | 'error'; message?: string };

/**
 * Settings → GitHub: what Siftlume reads from GitHub, what the optional token changes, how to
 * create a read-only one, and a check that it works.
 */
export function GitHubPanel({ token, onChange }: { token: string; onChange: (token: string) => void }) {
  const { t, i18n } = useTranslation('settings');
  const [show, setShow] = useState(false);
  const [check, setCheck] = useState<Check>({ status: 'idle' });
  const does = t('github.does', { returnObjects: true }) as string[];
  const steps = t('github.steps', { returnObjects: true }) as string[];

  const runCheck = () => {
    setCheck({ status: 'checking' });
    void checkGithubToken(token)
      .then(({ limit, remaining }) =>
        setCheck({
          status: 'ok',
          message: t('github.checkOk', {
            limit: limit.toLocaleString(i18n.language),
            remaining: remaining.toLocaleString(i18n.language),
          }),
        }),
      )
      .catch((e) => setCheck({ status: 'error', message: describeError(e) }));
  };

  return (
    <>
      <section className="panel">
        <h2>{t('github.heading')}</h2>
        <p className="hint github-intro">{t('github.intro')}</p>

        <div className="field">
          <label htmlFor="github-token">
            {t('github.token')} <span className="muted">{t('connect.optional')}</span>
          </label>
          <div className="row">
            <input
              id="github-token"
              className="input"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="github_pat_…"
              value={token}
              onChange={(e) => {
                onChange(e.target.value.trim());
                setCheck({ status: 'idle' });
              }}
            />
            <button className="btn" onClick={() => setShow(!show)}>
              {show ? t('connect.hide') : t('connect.show')}
            </button>
            <button className="btn" onClick={runCheck} disabled={!token || check.status === 'checking'}>
              {check.status === 'checking' ? t('github.checking') : t('github.check')}
            </button>
          </div>
          {check.message && (
            <p className={`hint ${check.status === 'error' ? 'hint--error' : ''}`} role="status">
              {check.message}
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>{t('github.doesHeading')}</h2>
        <ul className="key-guide__steps">
          {does.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="hint">{t('github.withoutToken')}</p>
      </section>

      <section className="panel">
        <h2>{t('github.howHeading')}</h2>
        <ol className="key-guide__steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <a className="btn btn--sm key-guide__open" href={CREATE_URL} target="_blank" rel="noreferrer">
          {t('github.create')} ↗
        </a>
      </section>
    </>
  );
}
