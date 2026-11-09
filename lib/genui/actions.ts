import { defineAction, type ActionPlan } from '@openuidev/react-lang';
import { z } from 'zod/v4';

// The Renderer does not run custom actions itself: it emits an event to onAction and the app handles it.

export const highlightInPage = defineAction({
  name: 'HighlightInPage',
  description:
    'Scrolls the original web page to the given exact quote and highlights it. Only usable when the source is a web page.',
  params: z.object({
    text: z.string().describe('An exact, verbatim phrase copied from the source (5-25 words).'),
  }),
});

export const copyText = defineAction({
  name: 'CopyText',
  description: 'Copies text to the user clipboard.',
  params: z.object({
    text: z.string(),
  }),
});

/**
 * Fires a library action from our own component. It must be an ActionPlan step: the legacy
 * `{ type, params }` form is silently dropped by the Renderer when `type` names a registered
 * custom action, so the click would never reach onAction.
 */
export const customAction = (name: string, params: Record<string, unknown>): ActionPlan => ({
  steps: [{ type: 'custom_action', name, params }],
});
