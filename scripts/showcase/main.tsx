import '../../lib/no-openui-devtools';
import type { ReactElement } from 'react';
import ReactDOM from 'react-dom/client';
import { Renderer } from '@openuidev/react-lang';
import '../../lib/i18n/react';
import '@openuidev/react-ui/components.css';
import '@openuidev/react-ui/styles/index.css';
import '../../assets/fonts';
import '../../assets/app.css';
import '../../assets/genui.css';
import './showcase.css';
import { ArrowExpand01Icon, ArrowUp02Icon, Clock01Icon, RefreshIcon, Settings02Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/Icon';
import { Themed } from '../../components/Themed';
import { SettingsForm } from '../../components/SettingsForm';
import { ResultToolbar } from '../../components/ResultToolbar';
import type { SessionController } from '../../components/useSession';
import type { Session } from '../../lib/history';
import { library } from '../../lib/library';
import { CHART_SUMMARY_EXAMPLE } from '../../lib/chart-example';
import { NEWS_ACTORS_EXAMPLE, REVIEW_SUMMARY_EXAMPLE } from '../../lib/review-example';
import { DEFAULT_SETTINGS, type Settings } from '../../lib/settings';
import { ARTICLE, SUMMARY } from './content';

const view = new URLSearchParams(location.search).get('view') ?? 'compare';
const dark = new URLSearchParams(location.search).has('dark');
const settings: Settings = { ...DEFAULT_SETTINGS, theme: dark ? 'dark' : 'light' };

function Topbar({ wide }: { wide?: boolean }) {
  return (
    <header className="topbar">
      <span className="brand">Siftlume</span>
      <span className="model-switch">
        <span className="model-switch__provider">Anthropic</span>
        <span className="model-switch__model">Claude Haiku 5.5</span>
      </span>
      <nav>
        {wide ? <span className="btn btn--sm">New</span> : null}
        <span className="icon-btn">
          <Icon icon={Clock01Icon} />
        </span>
        <span className="icon-btn">
          <Icon icon={Settings02Icon} />
        </span>
      </nav>
    </header>
  );
}

function SourceRow({ title, panel }: { title: string; panel?: boolean }) {
  return (
    <header className="source">
      <div className="source__meta">
        <span className="sc-favicon">D</span>
        <span className="source__title">{title}</span>
        <span className="time-saved">~12 min saved</span>
      </div>
      <div className="source__actions">
        <span className="tool-btn">
          <Icon icon={RefreshIcon} size={16} />
          {!panel && <span>Summarize again</span>}
        </span>
        {panel && (
          <span className="tool-btn">
            <Icon icon={ArrowExpand01Icon} size={16} />
          </span>
        )}
      </div>
    </header>
  );
}

const Ask = () => (
  <div className="ask sc-ask">
    <span className="input sc-placeholder">Ask anything about this…</span>
    <span className="btn btn--primary btn--icon">
      <Icon icon={ArrowUp02Icon} />
    </span>
  </div>
);

const Chips = () => (
  <section className="refine">
    <div className="chips">
      {['Shorter', 'More detail', 'Action items', 'Timeline', 'Simpler'].map((c) => (
        <span key={c} className="chip">
          {c}
        </span>
      ))}
    </div>
  </section>
);

/** Before / after: the original article next to the side panel summary. */
function Compare() {
  return (
    <div className="sc-compare">
      <section className="sc-col">
        <p className="sc-label">
          Before <span>a 14-minute article</span>
        </p>
        <div className="sc-browser">
          <div className="sc-chrome">
            <i />
            <i />
            <i />
            <span>{ARTICLE.url}</span>
          </div>
          <article className="sc-article">
            <p className="sc-site">{ARTICLE.site}</p>
            <p className="sc-section">{ARTICLE.section}</p>
            <h1>{ARTICLE.title}</h1>
            <p className="sc-dek">{ARTICLE.dek}</p>
            <p className="sc-byline">{ARTICLE.byline}</p>
            <div className="sc-ad">Advertisement</div>
            {ARTICLE.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <div className="sc-ad">Advertisement</div>
            {ARTICLE.paragraphs.slice(0, 4).map((p, i) => (
              <p key={`r${i}`}>{p}</p>
            ))}
          </article>
        </div>
      </section>
      <div className="sc-arrow" aria-hidden="true">
        →
      </div>
      <section className="sc-col sc-col--after">
        <p className="sc-label">
          After <span>Siftlume, in the side panel</span>
        </p>
        <Themed settings={settings} className="app app--panel sc-panel">
          <Topbar />
          <main className="content">
            <div className="session session--panel">
              <SourceRow title="dailycurrent.example" panel />
              <div className="session__main">
                <section className="summary">
                  <div className="genui">
                    <Renderer library={library} response={SUMMARY} isStreaming={false} />
                  </div>
                </section>
              </div>
            </div>
          </main>
        </Themed>
      </section>
    </div>
  );
}

const stubCtrl = { phase: 'idle', resummarize: () => {} } as unknown as SessionController;
const stubSession = {
  id: 'showcase',
  createdAt: 0,
  updatedAt: 0,
  source: {
    kind: 'webpage',
    title: 'Acme investor report',
    origin: 'https://ir.acme.example',
    content: '',
    truncated: false,
  },
  summary: null,
  qa: [],
} as Session;

/** Full-page tab with charts and the Questions column. */
function FullPage() {
  return (
    <Themed settings={settings} className="app app--page sc-full">
      <Topbar wide />
      <main className="content">
        <div className="session session--page">
          <SourceRow title="ir.acme.example" />
          <div className="session__main">
            <ResultToolbar
              ctrl={stubCtrl}
              session={stubSession}
              settings={settings}
              program={CHART_SUMMARY_EXAMPLE}
              notify={() => {}}
              sourceOpen={false}
              onToggleSource={() => {}}
            />
            <section className="summary">
              <div className="genui">
                <Renderer library={library} response={CHART_SUMMARY_EXAMPLE} isStreaming={false} />
              </div>
            </section>
            <Chips />
          </div>
          <aside className="session__side">
            <section className="qa">
              <h3 className="section-title">Questions</h3>
              <div className="qa__turn">
                <div className="bubble">Why is hardware shrinking?</div>
                <div className="answer">
                  <p>
                    Customers are moving from on-premise servers to cloud subscriptions, so hardware revenue fell for
                    the fourth quarter in a row while cloud grew.
                  </p>
                </div>
              </div>
            </section>
            <Ask />
          </aside>
        </div>
      </main>
    </Themed>
  );
}

/** The review and news examples side by side: Verdict, ProsCons, BarList, Checklist, People, Glossary. */
function Components() {
  return (
    <Themed settings={settings} className="app app--page sc-components">
      <main className="content sc-components__grid">
        {[REVIEW_SUMMARY_EXAMPLE, NEWS_ACTORS_EXAMPLE].map((program, i) => (
          <div key={i} className="session session--page sc-components__col">
            <div className="session__main">
              <section className="summary">
                <div className="genui">
                  <Renderer library={library} response={program} isStreaming={false} />
                </div>
              </section>
            </div>
          </div>
        ))}
      </main>
    </Themed>
  );
}

function SettingsView() {
  return (
    <Themed settings={settings} className="app app--page sc-settings">
      <main className="content">
        <SettingsForm embedded onClose={() => {}} initialTab="appearance" />
      </main>
    </Themed>
  );
}

const views: Record<string, () => ReactElement> = {
  compare: Compare,
  fullpage: FullPage,
  settings: SettingsView,
  components: Components,
};
const View = views[view] ?? Compare;
ReactDOM.createRoot(document.getElementById('root')!).render(<View />);
