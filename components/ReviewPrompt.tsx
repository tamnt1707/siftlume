import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StarIcon } from '@hugeicons/core-free-icons';
import { HAS_STORE_REVIEW } from '@/lib/platform';
import { ISSUES_URL } from '@/lib/report';
import { askLater, INITIAL, REVIEW_URL, reviewPromptItem, shouldAsk, stopAsking } from '@/lib/review-prompt';
import { Icon } from './Icon';

/**
 * Under a finished summary, after a few summaries: a store review, a problem report, later, or
 * never. The same choices for everyone, with no "Are you happy?" step in front (see
 * lib/review-prompt.ts).
 */
export function ReviewPrompt() {
  const { t } = useTranslation('session');
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!HAS_STORE_REVIEW) return;
    let live = true;
    const show = (s: typeof INITIAL | null) => live && setAsk(shouldAsk({ ...INITIAL, ...s }));
    void reviewPromptItem.getValue().then(show);
    // The count goes up just after a summary finishes; another open view answering hides it here too.
    const unwatch = reviewPromptItem.watch(show);
    return () => {
      live = false;
      unwatch();
    };
  }, []);

  // Hidden at once; storage then tells any other open view.
  const answer = (choice: () => Promise<void>) => () => {
    setAsk(false);
    void choice();
  };

  if (!ask) return null;
  return (
    <aside className="review-prompt" aria-label={t('review.title')}>
      <Icon icon={StarIcon} size={18} className="review-prompt__icon" />
      <div className="review-prompt__body">
        <strong>{t('review.title')}</strong>
        <p>{t('review.text')}</p>
        <div className="review-prompt__actions">
          <a
            className="btn btn--primary btn--sm"
            href={REVIEW_URL}
            target="_blank"
            rel="noreferrer"
            onClick={answer(stopAsking)}
          >
            {t('review.rate')}
          </a>
          <a className="btn btn--sm" href={ISSUES_URL} target="_blank" rel="noreferrer">
            {t('review.report')}
          </a>
          <span className="review-prompt__later">
            <button type="button" className="link" onClick={answer(askLater)}>
              {t('review.later')}
            </button>
            <button type="button" className="link" onClick={answer(stopAsking)}>
              {t('review.never')}
            </button>
          </span>
        </div>
      </div>
    </aside>
  );
}
