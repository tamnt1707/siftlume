import { getSession, type HistoryEntry } from './history';
import { pickForQuestion } from './library-search';
import { streamCompletion } from './llm';
import { programToMarkdown } from './markdown';
import { readStored } from './history';
import type { Settings } from './settings';

/**
 * "Ask your history": a question answered from the summaries of what the reader has read (not
 * the sources, which would not fit), citing them as [1], [2]…
 */

/** Summaries sent at most, and characters of each. */
const MAX_SOURCES = 8;
const MAX_EACH = 3500;

export async function askHistory(args: {
  settings: Settings;
  entries: HistoryEntry[];
  question: string;
  signal?: AbortSignal;
  onText: (text: string) => void;
}) {
  const { settings, entries, question, signal, onText } = args;
  const picked = pickForQuestion(entries, question, MAX_SOURCES);
  const sessions = (await Promise.all(picked.map((e) => getSession(e.id)))).filter((s) => s !== null);
  const docs = sessions.map((s, i) => {
    const program = readStored(s.summary).content;
    const body = (program ? programToMarkdown(program) : '') || s.source.content.slice(0, MAX_EACH);
    const date = new Date(s.updatedAt).toISOString().slice(0, 10);
    const answers = s.qa
      .slice(-3)
      .map((q) => `Q: ${q.question}\nA: ${readStored(q.answer).content.slice(0, 500)}`)
      .join('\n');
    return `<summary index="${i + 1}" title="${s.source.title.replace(/"/g, "'")}" date="${date}"${s.source.origin ? ` url="${s.source.origin}"` : ''}>\n${body.slice(0, MAX_EACH)}${answers ? `\n\nEarlier questions:\n${answers}` : ''}\n</summary>`;
  });
  const lang = settings.language && settings.language !== 'auto' ? settings.language : 'the language of the question';
  const text = await streamCompletion({
    settings,
    signal,
    system: [
      'You answer questions about what the user has read, using only the summaries of their reading history below.',
      'Cite the summaries you use as [1], [2]… by their index. Combine and compare them when several are relevant.',
      'If they do not contain the answer, say so plainly and do not guess.',
      `Answer in ${lang}, in short Markdown: a direct answer first, then a few bullet points if useful.`,
    ].join(' '),
    messages: [{ role: 'user', content: `${docs.join('\n\n')}\n\nQuestion: ${question}` }],
    onText,
  });
  return { text, sources: sessions.map((s) => ({ id: s.id, title: s.source.title })) };
}
