import { pullRequestRef } from './github';
import { googleFileRef } from './gdocs';
import { youTubeVideoId } from './youtube';
import { isMeetUrl } from './meet';

/** Pages read their own way instead of as an article: what the start screen and popup call them. */
export type SpecialPage = 'video' | 'pr' | 'doc' | 'sheet' | 'slides' | 'drive' | 'meet';

export function specialPage(url?: string): SpecialPage | null {
  if (youTubeVideoId(url)) return 'video';
  if (isMeetUrl(url)) return 'meet';
  if (pullRequestRef(url)) return 'pr';
  const file = googleFileRef(url);
  if (file)
    return ({ document: 'doc', spreadsheet: 'sheet', presentation: 'slides', drive: 'drive' } as const)[file.type];
  return null;
}

/** The run button's label set (picker:run, runVideo, …) for a page. */
export const RUN_LABELS = {
  video: 'runVideo',
  pr: 'runPr',
  doc: 'runDoc',
  sheet: 'runSheet',
  slides: 'runSlides',
  drive: 'runDrive',
  meet: 'run',
} as const;
