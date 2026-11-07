import { browser } from '#imports';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

export function isLocalUrl(url: string) {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

const applied = new Set<string>();

/** Stable rule id per origin (session rule ids must be positive integers). */
function ruleIdFor(origin: string) {
  let h = 0;
  for (let i = 0; i < origin.length; i++) h = (h * 31 + origin.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1_000_000) + 1;
}

/**
 * Local servers such as Ollama reject requests whose Origin is `chrome-extension://…` (HTTP 403)
 * unless the user sets OLLAMA_ORIGINS. Chrome omits Origin on simple GETs (so listing models works)
 * but always sends it on POST. This session rule rewrites Origin to the server's own origin,
 * which local servers allow by default.
 *
 * The rule only matches requests initiated by this extension, so web pages cannot use it to bypass
 * the local server's origin protection. Requires host permission for the server (granted on Save).
 */
export async function allowLocalOrigin(baseUrl: string) {
  if (!isLocalUrl(baseUrl)) return;
  const origin = new URL(baseUrl).origin;
  if (applied.has(origin)) return;

  const id = ruleIdFor(origin);
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [id],
    addRules: [
      {
        id,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [{ header: 'origin', operation: 'set', value: origin }],
        },
        condition: {
          urlFilter: `|${origin}/`,
          initiatorDomains: [browser.runtime.id],
          resourceTypes: ['xmlhttprequest', 'other'],
        },
      },
    ],
  });
  applied.add(origin);
}
