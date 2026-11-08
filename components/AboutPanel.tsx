import { Coffee01Icon, LinkSquare02Icon } from '@hugeicons/core-free-icons';
import { useTranslation } from 'react-i18next';
import { browser } from '#imports';
import { Icon } from './Icon';

export const KOFI_URL = 'https://ko-fi.com/tamnt';
const LICENSE_URL = 'https://opensource.org/license/mit';

/** Settings → About: identity, version, how to support the project, license. */
export function AboutPanel() {
  const { t } = useTranslation(['settings', 'common']);
  const version = browser.runtime.getManifest?.().version ?? '';

  return (
    <section className="panel about">
      <div className="about__identity">
        <img className="about__logo" src="/logo.svg" alt="" width={56} height={56} />
        <div>
          <h2 className="about__name">{t('common:appName')}</h2>
          <p className="about__tagline">{t('about.tagline')}</p>
          {version && <p className="hint">{t('about.version', { version })}</p>}
        </div>
      </div>

      <div className="about__support">
        <div>
          <strong>{t('about.supportTitle')}</strong>
          <p className="muted">{t('about.supportText')}</p>
        </div>
        <a className="btn btn--primary kofi" href={KOFI_URL} target="_blank" rel="noreferrer">
          <Icon icon={Coffee01Icon} size={18} />
          {t('about.supportButton')}
        </a>
      </div>

      <p className="hint about__license">
        {t('about.license')}{' '}
        <a href={LICENSE_URL} target="_blank" rel="noreferrer">
          MIT <Icon icon={LinkSquare02Icon} size={12} />
        </a>
      </p>
    </section>
  );
}
