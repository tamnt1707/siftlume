import { pullRequestRef } from './github';
import { googleFileRef } from './gdocs';
import { youTubeVideoId } from './youtube';

/** Pages read their own way instead of as an article: what the start screen and popup call them. */
export type SpecialPage = 'video' | 'pr' | 'doc' | 'sheet';

export function specialPage(url?: string): SpecialPage | null {
  if (youTubeVideoId(url)) return 'video';
  if (pullRequestRef(url)) return 'pr';
  const file = googleFileRef(url);
  if (file) return file.type === 'document' ? 'doc' : 'sheet';
  return null;
}

/** The run button's label set (picker:run, runVideo, …) for a page. */
export const RUN_LABELS = { video: 'runVideo', pr: 'runPr', doc: 'runDoc', sheet: 'runSheet' } as const;
