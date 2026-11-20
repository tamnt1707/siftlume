import { storage } from '#imports';
import { HAS_STORE_REVIEW } from './platform';

/**
 * "Enjoying Siftlume?": a small card under a finished summary, after a few summaries, asking for a
 * store review. Everyone gets the same choices (review, report a problem, later, never): asking
 * first whether people are happy and sending only the happy ones to the store is review gating,
 * which the Chrome Web Store forbids.
 */

export const REVIEW_URL = 'https://chromewebstore.google.com/detail/siftlume/ohbbflajppmdigjgbdhgaphmjidmfafa/reviews';

/** Summaries before the first ask, and between "Later" and the next one. */
export const FIRST_ASK = 5;
export const ASK_AGAIN_AFTER = 10;

export interface ReviewPrompt {
  /** Summaries finished so far. */
  count: number;
  /** The count at which the card shows. */
  askAt: number;
  /** Reviewed, or "Don't ask again": never shown again. */
  done: boolean;
}

export const INITIAL: ReviewPrompt = { count: 0, askAt: FIRST_ASK, done: false };

export const shouldAsk = (s: ReviewPrompt) => !s.done && s.count >= s.askAt;
export const counted = (s: ReviewPrompt): ReviewPrompt => ({ ...s, count: s.count + 1 });
export const later = (s: ReviewPrompt): ReviewPrompt => ({ ...s, askAt: s.count + ASK_AGAIN_AFTER });
export const finished = (s: ReviewPrompt): ReviewPrompt => ({ ...s, done: true });

export const reviewPromptItem = storage.defineItem<ReviewPrompt>('local:reviewPrompt', { fallback: INITIAL });

const update = async (change: (s: ReviewPrompt) => ReviewPrompt) =>
  reviewPromptItem.setValue(change({ ...INITIAL, ...(await reviewPromptItem.getValue()) }));

/** Called once per finished summary. Nothing is counted where there is no store page to review on. */
export const countSummary = () => (HAS_STORE_REVIEW ? update(counted) : Promise.resolve());
export const askLater = () => update(later);
export const stopAsking = () => update(finished);
