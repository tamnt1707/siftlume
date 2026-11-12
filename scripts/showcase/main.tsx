import '../../lib/no-openui-devtools';
import { SHOWCASE_CUSTOM_MODES } from './imports-stub';
import type { ReactElement } from 'react';
import ReactDOM from 'react-dom/client';
import { Renderer } from '@openuidev/react-lang';
import i18n from '../../lib/i18n/react';
import '@openuidev/react-ui/components.css';
import '@openuidev/react-ui/styles/index.css';
import '../../assets/fonts';
import '../../assets/app.css';
import '../../assets/genui.css';
import './showcase.css';
import { ArrowExpand01Icon, ArrowUp02Icon, Clock01Icon, RefreshIcon, Settings02Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/Icon';
import { Themed } from '../../components/Themed';
import { SiftLoader } from '../../components/SiftLoader';
import { SourcePicker } from '../../components/SourcePicker';
import { DeepRead } from '../../components/DeepRead';
import { HistoryView } from '../../components/HistoryView';
import { ACTION_EXAMPLE, CRITIQUE_EXAMPLE, EXPLAIN_EXAMPLE } from '../../lib/mode-example';
import { SettingsForm } from '../../components/SettingsForm';
import { ResultToolbar } from '../../components/ResultToolbar';
import type { SessionController } from '../../components/useSession';
import { PR_REVIEW_EXAMPLE, PRODUCT_EVENT_EXAMPLE, RECIPE_EXAMPLE } from '../../lib/component-example';
import { MarkDownRenderer } from '@openuidev/react-ui';
import { VISUAL_SUMMARY_EXAMPLE } from '../../lib/summary-example';
import { GenUI } from '../../components/GenUI';
import { ThemeToggle } from '../../components/ThemeToggle';
import type { Session } from '../../lib/history';
import { library } from '../../lib/library';
import { CHART_SUMMARY_EXAMPLE } from '../../lib/chart-example';
import { NEWS_ACTORS_EXAMPLE, REVIEW_SUMMARY_EXAMPLE } from '../../lib/review-example';
import { PRODUCT_COMPARE_EXAMPLE, RELEASE_NOTES_EXAMPLE, RESEARCH_PAPER_EXAMPLE } from '../../lib/domain-example';
import { CODE_TUTORIAL_EXAMPLE, DECISION_EXAMPLE, POLICY_DEBATE_EXAMPLE } from '../../lib/analysis-example';
import { DEFAULT_SETTINGS, type Settings } from '../../lib/settings';
import { ARTICLE, SUMMARY } from './content';
import { POSTS } from './posts-vi';

const query = new URLSearchParams(location.search);
const view = query.get('view') ?? 'compare';
const dark = new URLSearchParams(location.search).has('dark');
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  theme: dark ? 'dark' : 'light',
  customModes: SHOWCASE_CUSTOM_MODES as Settings['customModes'],
};

function Topbar({
  wide,
  provider = 'Anthropic',
  model = 'Claude Haiku 5.5',
  tools,
}: {
  wide?: boolean;
  provider?: string;
  model?: string;
  /** Full page: the result toolbar, as the app places it in the bar. */
  tools?: ReactElement;
}) {
  return (
    <header className="topbar">
      <span className="brand">Siftlume</span>
      <span className="model-switch">
        <span className="model-switch__provider">{provider}</span>
        <span className="model-switch__model">{model}</span>
      </span>
      {tools && <div className="topbar__tools">{tools}</div>}
      <nav>
        {wide ? <span className="btn btn--sm">New</span> : null}
        <span className="icon-btn">
          <Icon icon={Clock01Icon} />
        </span>
        <ThemeToggle settings={settings} />
        <span className="icon-btn">
          <Icon icon={Settings02Icon} />
        </span>
      </nav>
    </header>
  );
}

function SourceRow({ title, panel, saved = '~12 min saved' }: { title: string; panel?: boolean; saved?: string }) {
  return (
    <header className="source">
      <div className="source__meta">
        <span className="sc-favicon">{title[0]!.toUpperCase()}</span>
        <span className="source__title">{title}</span>
        <span className="time-saved">{saved}</span>
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

/**
 * An English tech article next to the summary written in Vietnamese, for posts in Vietnamese
 * communities. `?view=post&post=passkeys|database|docker|microservices&lang=vi`.
 */
function PostCompare() {
  const post = POSTS[query.get('post') ?? 'passkeys'] ?? POSTS.passkeys!;
  const host = post.url.split('/')[0]!;
  return (
    <div className="sc-compare sc-compare--post">
      <section className="sc-col">
        <p className="sc-label">
          Bài gốc <span>tiếng Anh, {post.minutes} phút đọc</span>
        </p>
        <div className="sc-browser">
          <div className="sc-chrome">
            <i />
            <i />
            <i />
            <span>{post.url}</span>
          </div>
          <article className="sc-article">
            <p className="sc-site">{post.site}</p>
            <p className="sc-section">{post.section}</p>
            <h1>{post.title}</h1>
            <p className="sc-dek">{post.dek}</p>
            <p className="sc-byline">{post.byline}</p>
            <div className="sc-ad">Advertisement</div>
            {post.paragraphs.map((p, i) => (
              <div key={i}>
                <p>{p}</p>
                {post.code && i === post.codeAfter && <pre className="sc-code">{post.code}</pre>}
              </div>
            ))}
          </article>
        </div>
      </section>
      <div className="sc-arrow" aria-hidden="true">
        →
      </div>
      <section className="sc-col sc-col--after">
        <p className="sc-label">
          Siftlume <span>tóm tắt tiếng Việt · {post.mode}</span>
        </p>
        <Themed settings={settings} className="app app--panel sc-panel">
          <Topbar provider="Google" model="Gemini 2.5 Flash" />
          <main className="content">
            <div className="session session--panel">
              <SourceRow title={host} panel saved={`Tiết kiệm ~${post.minutes - 2} phút`} />
              <div className="session__main">
                <section className="summary">
                  <div className="genui">
                    <Renderer library={library} response={post.summary} isStreaming={false} />
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
    // Links for Deep read: the report points to its filing, a call transcript and a press release.
    content:
      'Acme reported Q3 results. Details are in the [full 10-Q filing](https://sec.example.gov/acme-10q), the [earnings call transcript](https://ir.acme.example/q3-call) and the [cloud segment press release](https://news.acme.example/cloud-q3). Follow us on [LinkedIn](https://linkedin.com/company/acme).',
    truncated: false,
  },
  summary: null,
  qa: [],
} as Session;

/** Deep read's link picker, as it opens under the source line (`?view=deep`). */
function DeepPicker() {
  return (
    <Themed settings={settings} className="app app--panel sc-components">
      <main className="content" style={{ maxWidth: 420 }}>
        <div className="source">
          <DeepRead ctrl={stubCtrl} session={stubSession} settings={settings} onClose={() => {}} />
        </div>
      </main>
    </Themed>
  );
}

/** Full-page tab with charts and the Questions column. */
function FullPage() {
  return (
    <Themed settings={settings} className="app app--page sc-full">
      {/* `&width=1100`: a narrower window, where the bar's tools take a second row. */}
      {query.has('width') && <style>{`.sc-full { width: ${Number(query.get('width'))}px; }`}</style>}
      <Topbar
        wide
        tools={
          <ResultToolbar
            ctrl={stubCtrl}
            session={stubSession}
            settings={settings}
            program={CHART_SUMMARY_EXAMPLE}
            notify={() => {}}
            sourceOpen={false}
            onToggleSource={() => {}}
          />
        }
      />
      <main className="content">
        <div className="session session--page">
          <SourceRow title="ir.acme.example" />
          <div className="session__main">
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

/**
 * Prompt examples rendered side by side. Default: review and news (Verdict, ProsCons, BarList,
 * Checklist, People, Glossary). `?set=domain`: product, release notes and research examples.
 * `?set=analysis`: policy debate, decision and code tutorial (the analysis blocks).
 * `&panel` renders them at side-panel width.
 */
const COMPONENT_SETS: Record<string, string[]> = {
  default: [REVIEW_SUMMARY_EXAMPLE, NEWS_ACTORS_EXAMPLE],
  domain: [PRODUCT_COMPARE_EXAMPLE, RELEASE_NOTES_EXAMPLE, RESEARCH_PAPER_EXAMPLE],
  modes: [EXPLAIN_EXAMPLE, CRITIQUE_EXAMPLE, ACTION_EXAMPLE],
  analysis: [POLICY_DEBATE_EXAMPLE, DECISION_EXAMPLE, CODE_TUTORIAL_EXAMPLE],
  everyday: [PR_REVIEW_EXAMPLE, RECIPE_EXAMPLE, PRODUCT_EVENT_EXAMPLE],
  visual: [VISUAL_SUMMARY_EXAMPLE],
};

function Components() {
  const programs = COMPONENT_SETS[query.get('set') ?? 'default'] ?? COMPONENT_SETS.default!;
  const panel = query.has('panel');
  return (
    <Themed settings={settings} className="app app--page sc-components">
      <main className="content sc-components__grid" style={{ gridTemplateColumns: `repeat(${programs.length}, 1fr)` }}>
        {programs.map((program, i) => (
          <div
            key={i}
            className={`session ${panel ? 'session--panel' : 'session--page'} sc-components__col`}
            style={panel ? { display: 'block', maxWidth: 400 } : undefined}
          >
            <div className="session__main">
              <section className="summary">
                {/* The app's wrapper, so its relabelled headings show too. */}
                <GenUI response={program} isStreaming={false} onAction={() => {}} />
              </section>
            </div>
          </div>
        ))}
      </main>
    </Themed>
  );
}

/** Every loading state: reading, sifting (first run), redoing a summary (overlay), streaming (strip). */
function Loaders() {
  const t = (k: 'loader.reading' | 'loader.sifting' | 'loader.reanalyzing' | 'loader.drawing') =>
    i18n.t(k, { ns: 'common' });
  return (
    <Themed settings={settings} className="app app--page sc-components">
      <main className="content sc-components__grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="session session--page sc-components__col">
          <SiftLoader stage="reading" title={t('loader.reading')} onStop={() => {}} />
          <SiftLoader stage="sifting" title={t('loader.sifting')} onStop={() => {}} />
        </div>
        <div className="session session--panel sc-components__col" style={{ display: 'block', maxWidth: 400 }}>
          <section className="summary is-reworking">
            <SiftLoader stage="sifting" title={t('loader.reanalyzing')} variant="overlay" onStop={() => {}} />
            <div className="genui">
              <Renderer library={library} response={REVIEW_SUMMARY_EXAMPLE} isStreaming={false} />
            </div>
          </section>
          <section className="summary" style={{ marginTop: 24 }}>
            <SiftLoader stage="drawing" title={t('loader.drawing')} variant="strip" onStop={() => {}} />
          </section>
        </div>
      </main>
    </Themed>
  );
}

/** Start screens with the analysis mode picker: full page (with descriptions) and a tab's side panel. */
function Pickers() {
  const idle = { phase: 'idle' } as unknown as SessionController;
  return (
    <Themed settings={settings} className="app app--page sc-components">
      <main className="content sc-components__grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="narrow">
          <SourcePicker ctrl={idle} settings={settings} />
        </div>
        <div className="app--panel" style={{ maxWidth: 400 }}>
          <SourcePicker
            ctrl={idle}
            settings={settings}
            page={{ id: 1, title: 'How vaccines train the immune system', readable: true }}
            startTabs={query.has('tabs')}
          />
        </div>
      </main>
    </Themed>
  );
}

function SettingsView() {
  return (
    <Themed
      settings={settings}
      className={query.has('narrow') ? 'app app--panel sc-settings sc-settings--narrow' : 'app app--page sc-settings'}
    >
      <main className="content">
        <SettingsForm
          embedded
          onClose={() => {}}
          initialTab={(query.get('tab') as 'ai' | 'appearance' | null) ?? 'appearance'}
        />
      </main>
    </Themed>
  );
}

// ── Chrome Web Store assets ─────────────────────────────────────────────────────

/** Store screenshots (1280×800): a caption above a scaled live view. */
const STORE_SHOTS: { title: string; sub: string; src: string; width: number }[] = [
  {
    title: 'Long articles in, summaries you can scan in seconds',
    sub: 'A one-line TL;DR, key figures, takeaways and a timeline, next to the page you are reading.',
    src: 'view=compare',
    width: 1360,
  },
  {
    title: 'Numbers become charts. Questions get answers.',
    sub: 'Charts picked from the shape of the data, plus follow-up questions answered only from the source.',
    src: 'view=fullpage',
    width: 1360,
  },
  {
    title: 'Made for the content you read',
    sub: 'Verdicts and pros and cons for reviews, checklists for action items, who is who for the news.',
    src: 'view=components',
    width: 1360,
  },
  {
    title: 'Your AI, your key',
    sub: 'OpenAI, Claude, Gemini, OpenRouter, Groq and more, or a local model with Ollama. No Siftlume server.',
    src: 'view=settings&tab=ai',
    width: 1100,
  },
  {
    title: 'Light, dark, and your own colors',
    sub: 'Pick a color preset or your own pen and highlighter, in 12 interface languages.',
    src: 'view=fullpage&dark',
    width: 1360,
  },
];

function StoreShot() {
  const shot = STORE_SHOTS[Number(query.get('n') ?? 1) - 1] ?? STORE_SHOTS[0]!;
  const frameW = 1160;
  const scale = frameW / shot.width;
  return (
    <div className="st-shot">
      <header>
        <img src="/logo.svg" alt="" width={34} height={34} />
        <div>
          <h1>{shot.title}</h1>
          <p>{shot.sub}</p>
        </div>
      </header>
      <div className="st-frame" style={{ width: frameW }}>
        <iframe
          title="Siftlume"
          src={`?${shot.src}`}
          style={{ width: shot.width, height: 2000, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}

function PromoSmall() {
  return (
    <div className="st-promo-small">
      <span className="st-logo-plate" style={{ width: 96, height: 96 }}>
        <img src="/logo.svg" alt="" width={80} height={80} />
      </span>
      <div>
        <h1>Siftlume</h1>
        <p>Summarize any page, keep what matters.</p>
      </div>
    </div>
  );
}

function PromoMarquee() {
  return (
    <div className="st-marquee">
      <div className="st-marquee__text">
        <div className="st-marquee__brand">
          <span className="st-logo-plate" style={{ width: 56, height: 56, borderRadius: 16 }}>
            <img src="/logo.svg" alt="" width={46} height={46} />
          </span>
          <span>Siftlume</span>
        </div>
        <h1>Summarize any page, keep what matters.</h1>
        <ul>
          <li>Key figures, charts and takeaways at a glance</li>
          <li>Ask follow-up questions, answered from the source</li>
          <li>Your own AI provider, or a local model</li>
        </ul>
      </div>
      <div className="st-marquee__shot">
        <iframe title="Siftlume" src="?view=compare" style={{ width: 1360, height: 900, transform: 'scale(0.56)' }} />
      </div>
    </div>
  );
}

const LONG_NOTE = `**Đánh giá độ tin cậy: khoảng 7/10.**

**Điểm mạnh**
- Nguyên nhân được nêu rõ và khớp với diff: các phép so sánh dùng \`viewport.cols\` và \`viewport.rows\` bỏ qua gốc \`viewport.x\`.
- Có test đơn vị cho cả hai file, với viewport đặt tại (30, 1) và (30, 0).

**Điểm yếu và rủi ro**
- PR chưa có review nào và đang ở trạng thái mở.
- Sửa góc trên/dưới bằng điều kiện \`col != viewport.x + viewport.cols - 1\` cần được xem xét kỹ.`;

/** Text the model wrote outside the program, long (`?view=note`) or a short change note (`&short`). */
function NoteSample() {
  const short = query.has('short');
  return (
    <Themed settings={settings} className="app app--panel sc-panel">
      <main className="content">
        <section className="summary">
          <div className={short ? 'note' : 'summary-prose'}>
            <MarkDownRenderer
              textMarkdown={short ? 'Đã rút gọn phần **rủi ro** còn 3 ý.' : LONG_NOTE}
              variant="clear"
            />
          </div>
        </section>
      </main>
    </Themed>
  );
}

/** History with its search box (`?view=history&q=…` types a query). */
function HistoryShot() {
  return (
    <Themed settings={settings} className="app app--page">
      <main className="content">
        <div className="narrow">
          <h2 className="section-title">History</h2>
          <HistoryView settings={settings} onOpen={() => {}} />
        </div>
      </main>
    </Themed>
  );
}

const views: Record<string, () => ReactElement> = {
  store: StoreShot,
  'promo-small': PromoSmall,
  'promo-marquee': PromoMarquee,
  compare: Compare,
  post: PostCompare,
  fullpage: FullPage,
  settings: SettingsView,
  components: Components,
  note: NoteSample,
  loader: Loaders,
  pickers: Pickers,
  deep: DeepPicker,
  history: HistoryShot,
};
const View = views[view] ?? Compare;
ReactDOM.createRoot(document.getElementById('root')!).render(<View />);
