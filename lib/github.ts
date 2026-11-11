import { t } from '@/lib/i18n';
import type { ExtractedSource } from './extractors';

/**
 * GitHub pull requests are read through GitHub's public REST API, which answers any origin
 * (CORS "*"), so no site access is needed. Without a token it allows 60 requests an hour per IP
 * and public repositories only; a read-only token (Settings → Advanced) raises that to 5,000 and
 * opens private repositories. Reading one pull request takes about 7 requests.
 *
 * The result is one Markdown document: metadata, description, review state, conversation, review
 * threads on code, commits, then the diff file by file (noise such as lockfiles left out).
 */

export interface PullRequestRef {
  owner: string;
  repo: string;
  number: number;
}

/** The pull request a github.com URL shows (any of its tabs), or null. */
export function pullRequestRef(url?: string): PullRequestRef | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com') return null;
    const m = u.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)(?:\/|$)/);
    return m ? { owner: m[1]!, repo: m[2]!, number: Number(m[3]) } : null;
  } catch {
    return null;
  }
}

export const pullRequestUrl = (r: PullRequestRef) => `https://github.com/${r.owner}/${r.repo}/pull/${r.number}`;

// ── API ────────────────────────────────────────────────────────────────────────

type User = { login: string; type?: string } | null;
type Reactions = { total_count?: number; '+1'?: number; '-1'?: number };

interface Pull {
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  draft?: boolean;
  merged?: boolean;
  merged_at?: string | null;
  created_at: string;
  updated_at: string;
  user: User;
  labels?: { name: string }[];
  requested_reviewers?: { login: string }[];
  base: { ref: string };
  head: { ref: string; sha: string; label?: string };
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  comments: number;
  review_comments: number;
}

interface PullFile {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

interface IssueComment {
  user: User;
  author_association?: string;
  created_at: string;
  body: string | null;
  html_url: string;
  reactions?: Reactions;
}

interface Review {
  user: User;
  author_association?: string;
  state: string;
  body: string | null;
  submitted_at?: string;
  html_url: string;
}

interface ReviewComment {
  id: number;
  in_reply_to_id?: number;
  user: User;
  author_association?: string;
  path: string;
  line?: number | null;
  original_line?: number | null;
  diff_hunk?: string;
  body: string;
  created_at: string;
  html_url: string;
}

interface Commit {
  sha: string;
  commit: { message: string; author?: { name?: string } | null };
  author: User;
}

interface CheckRuns {
  check_runs: { name: string; status: string; conclusion: string | null }[];
}

const API = 'https://api.github.com';

class GitHubError extends Error {}

async function call<T>(path: string, token: string): Promise<{ data: T; next: string | null }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(path.startsWith('http') ? path : `${API}${path}`, { headers });
  } catch {
    throw new GitHubError(t('errors:github.network'));
  }
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if ((res.status === 403 || res.status === 429) && remaining === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const time = reset ? new Date(reset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?';
      throw new GitHubError(
        token ? t('errors:github.rateLimitToken', { time }) : t('errors:github.rateLimit', { time }),
      );
    }
    if (res.status === 401) throw new GitHubError(t('errors:github.badToken'));
    if (res.status === 404 || res.status === 403)
      throw new GitHubError(token ? t('errors:github.noAccessToken') : t('errors:github.notFound'));
    throw new GitHubError(t('errors:github.failed', { status: res.status }));
  }
  const next = res.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  return { data: (await res.json()) as T, next };
}

/** Every page of a list, up to `max` items. */
async function list<T>(path: string, token: string, max: number): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = `${path}${path.includes('?') ? '&' : '?'}per_page=100`;
  while (url && out.length < max) {
    const page: { data: T[]; next: string | null } = await call<T[]>(url, token);
    out.push(...page.data);
    url = page.next;
  }
  return out.slice(0, max);
}

/**
 * Checks a token (Settings → GitHub) with the rate limit endpoint, which does not count against
 * the limit: how many reads an hour it allows and how many are left.
 */
export async function checkGithubToken(token: string) {
  const { data } = await call<{ resources: { core: { limit: number; remaining: number } } }>('/rate_limit', token);
  return data.resources.core;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

/** Files whose diff tells a reader nothing: lockfiles, build output, minified or generated code. */
const NOISE = [
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|uv\.lock|Pipfile\.lock|Gemfile\.lock|composer\.lock|go\.sum|flake\.lock|Podfile\.lock|packages\.lock\.json)$/,
  /\.(min\.(js|css)|map|snap|lock)$/,
  /(^|\/)(dist|build|vendor|node_modules|__generated__|generated)\//,
  /(\.pb\.go|_pb2\.pyi?|\.g\.dart|\.designer\.cs)$/,
];

const isNoise = (path: string) => NOISE.some((re) => re.test(path));

/** Most of one file's diff a reader needs; past that, its first lines and a note. */
const MAX_PATCH_CHARS = 8_000;
/** All diffs together; files past it are listed by name only. */
const MAX_DIFF_CHARS = 250_000;
const MAX_COMMENT_CHARS = 4_000;
const MAX_BOT_CHARS = 600;

/** Comment text without HTML comments, images and badges; long ones cut. */
function clean(body: string | null | undefined, max = MAX_COMMENT_CHARS) {
  const text = (body ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > max ? `${text.slice(0, max)}… [cut]` : text;
}

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

const isBot = (u: User) => u?.type === 'Bot' || /\[bot\]$/.test(u?.login ?? '');

/** "@login (maintainer)" for owners, members and collaborators; "(bot)" for bots. */
function who(u: User, association?: string) {
  const name = `@${u?.login ?? 'ghost'}`;
  if (isBot(u)) return `${name} (bot)`;
  if (association && ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(association)) return `${name} (maintainer)`;
  return name;
}

function reactions(r?: Reactions) {
  const parts = [r?.['+1'] ? `👍 ${r['+1']}` : '', r?.['-1'] ? `👎 ${r['-1']}` : ''].filter(Boolean);
  return parts.length ? ` · ${parts.join(' ')}` : '';
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const STATE_LABEL: Record<string, string> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'requested changes',
  COMMENTED: 'commented',
  DISMISSED: 'review dismissed',
};

function reviewState(reviews: Review[], author?: string) {
  // Each reviewer's latest decision (comments alone do not change a decision). The author
  // answering in a review is not a decision.
  const latest = new Map<string, Review>();
  for (const r of reviews) {
    const key = r.user?.login ?? 'ghost';
    if (key === author) continue;
    if (r.state === 'COMMENTED' && latest.has(key)) continue;
    latest.set(key, r);
  }
  return [...latest.values()].map((r) => `${who(r.user, r.author_association)} ${STATE_LABEL[r.state] ?? r.state}`);
}

function checksLine(checks: CheckRuns | null) {
  const runs = checks?.check_runs ?? [];
  if (!runs.length) return null;
  const count = (pred: (c: CheckRuns['check_runs'][number]) => boolean) => runs.filter(pred).length;
  const failed = runs.filter((c) =>
    ['failure', 'timed_out', 'cancelled', 'action_required'].includes(c.conclusion ?? ''),
  );
  const parts = [
    `${count((c) => c.conclusion === 'success')} passed`,
    failed.length ? `${failed.length} failed (${failed.map((c) => c.name).join(', ')})` : '',
    count((c) => c.status !== 'completed') ? `${count((c) => c.status !== 'completed')} running` : '',
    count((c) => c.conclusion === 'skipped' || c.conclusion === 'neutral')
      ? `${count((c) => c.conclusion === 'skipped' || c.conclusion === 'neutral')} skipped`
      : '',
  ];
  return parts.filter(Boolean).join(', ');
}

/** Review comments grouped into threads (a first comment on a line and its replies). */
function threads(comments: ReviewComment[], url: string) {
  const roots = new Map<number, ReviewComment[]>();
  for (const c of comments) {
    const root = c.in_reply_to_id && roots.has(c.in_reply_to_id) ? c.in_reply_to_id : c.id;
    if (!roots.has(root)) roots.set(root, []);
    roots.get(root)!.push(c);
  }
  return [...roots.values()].map((thread) => {
    const first = thread[0]!;
    const line = first.line ?? first.original_line;
    const outdated = first.line == null ? ' (outdated: the code has changed since)' : '';
    const hunk = (first.diff_hunk ?? '').split('\n').slice(-4).join('\n');
    const replies = thread
      .map(
        (c) =>
          `- ${who(c.user, c.author_association)} (${day(c.created_at)}): ${clean(c.body, isBot(c.user) ? MAX_BOT_CHARS : MAX_COMMENT_CHARS)}`,
      )
      .join('\n');
    return `### \`${first.path}${line ? `:${line}` : ''}\`${outdated}\n[thread](${first.html_url || url})\n\`\`\`diff\n${hunk}\n\`\`\`\n${replies}`;
  });
}

async function filesSection(files: PullFile[], url: string) {
  let budget = MAX_DIFF_CHARS;
  const shown: string[] = [];
  const skipped: string[] = [];
  const listed: string[] = [];
  for (const f of files) {
    const name = f.previous_filename ? `${f.previous_filename} → ${f.filename}` : f.filename;
    const counts = `${f.status}, +${f.additions} −${f.deletions}`;
    if (isNoise(f.filename)) {
      skipped.push(`${name} (${counts})`);
      continue;
    }
    if (!f.patch) {
      skipped.push(`${name} (${counts}; binary or too large to show)`);
      continue;
    }
    if (budget <= 0) {
      listed.push(`${name} (${counts})`);
      continue;
    }
    let patch = f.patch;
    if (patch.length > MAX_PATCH_CHARS) patch = `${patch.slice(0, MAX_PATCH_CHARS)}\n… [rest of this file's diff cut]`;
    budget -= patch.length;
    const link = `${url}/files#diff-${await sha256Hex(f.filename)}`;
    shown.push(`### [${name}](${link}) (${counts})\n\`\`\`diff\n${patch}\n\`\`\``);
  }
  const out = [`## Files changed (${files.length})`, ...shown];
  if (listed.length) out.push(`### Not shown (diff too long to include)\n${listed.map((l) => `- ${l}`).join('\n')}`);
  if (skipped.length)
    out.push(`### Left out (lockfiles, generated, build output or binary)\n${skipped.map((l) => `- ${l}`).join('\n')}`);
  return out.join('\n\n');
}

// ── Reading ────────────────────────────────────────────────────────────────────

export async function extractPullRequest(ref: PullRequestRef, token: string): Promise<ExtractedSource> {
  const base = `/repos/${ref.owner}/${ref.repo}`;
  const { data: pr } = await call<Pull>(`${base}/pulls/${ref.number}`, token);
  const [files, comments, reviews, reviewComments, commits, checks] = await Promise.all([
    list<PullFile>(`${base}/pulls/${ref.number}/files`, token, 300),
    pr.comments ? list<IssueComment>(`${base}/issues/${ref.number}/comments`, token, 300) : [],
    list<Review>(`${base}/pulls/${ref.number}/reviews`, token, 200),
    pr.review_comments ? list<ReviewComment>(`${base}/pulls/${ref.number}/comments`, token, 300) : [],
    list<Commit>(`${base}/pulls/${ref.number}/commits`, token, 250),
    // CI is a detail: a pull request still reads without it.
    call<CheckRuns>(`${base}/commits/${pr.head.sha}/check-runs?per_page=100`, token)
      .then((r) => r.data)
      .catch(() => null),
  ]);

  const url = pullRequestUrl(ref);
  const state =
    pr.merged || pr.merged_at
      ? `merged ${day(pr.merged_at)}`
      : pr.state === 'closed'
        ? 'closed'
        : pr.draft
          ? 'draft'
          : 'open';
  const decisions = reviewState(reviews, pr.user?.login);
  const pending = (pr.requested_reviewers ?? []).map((r) => `@${r.login}`);
  const ci = checksLine(checks);

  const meta = [
    `Repository: ${ref.owner}/${ref.repo} · Pull request #${ref.number} · ${url}`,
    `Author: ${who(pr.user)} · State: ${state} · Opened ${day(pr.created_at)} · Updated ${day(pr.updated_at)}`,
    `Merges ${pr.head.label ?? pr.head.ref} into ${pr.base.ref} · ${pr.commits} commits · ${pr.changed_files} files, +${pr.additions} −${pr.deletions}`,
    pr.labels?.length ? `Labels: ${pr.labels.map((l) => l.name).join(', ')}` : '',
    `Reviews: ${decisions.length ? decisions.join('; ') : 'none yet'}${pending.length ? ` · Waiting for: ${pending.join(', ')}` : ''}`,
    ci ? `CI checks: ${ci}` : '',
  ].filter(Boolean);

  const reviewBodies = reviews
    .filter((r) => clean(r.body))
    .map(
      (r) =>
        `### ${who(r.user, r.author_association)} ${STATE_LABEL[r.state] ?? r.state} (${day(r.submitted_at)})\n${clean(r.body, isBot(r.user) ? MAX_BOT_CHARS : MAX_COMMENT_CHARS)}`,
    );
  const conversation = comments.map(
    (c) =>
      `### ${who(c.user, c.author_association)} (${day(c.created_at)}${reactions(c.reactions)})\n${clean(c.body, isBot(c.user) ? MAX_BOT_CHARS : MAX_COMMENT_CHARS)}`,
  );
  const codeThreads = threads(reviewComments, url);
  const commitLines = commits.map(
    (c) =>
      `- ${c.sha.slice(0, 7)} ${c.commit.message.split('\n')[0]} (${c.author ? `@${c.author.login}` : (c.commit.author?.name ?? '')})`,
  );

  const sections = [
    `# ${pr.title} (#${ref.number})`,
    meta.join('\n'),
    `## Description\n${clean(pr.body, 20_000) || '(no description)'}`,
    reviewBodies.length ? `## Reviews\n\n${reviewBodies.join('\n\n')}` : '',
    conversation.length ? `## Conversation (${conversation.length} comments)\n\n${conversation.join('\n\n')}` : '',
    codeThreads.length ? `## Review threads on code (${codeThreads.length})\n\n${codeThreads.join('\n\n')}` : '',
    commitLines.length ? `## Commits (${pr.commits})\n${commitLines.join('\n')}` : '',
    await filesSection(files, url),
  ];

  return {
    kind: 'pr',
    title: `${pr.title} · #${ref.number}`,
    origin: url,
    content: sections.filter(Boolean).join('\n\n'),
  };
}
