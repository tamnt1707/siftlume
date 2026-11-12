/** An inline event handler attribute (onclick="…", onerror=…) inside a tag. */
const HANDLER_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/**
 * Removes inline event handlers from page HTML before DOMParser reads it. They carry no text, and
 * parsing them in an extension page makes Chrome log a Content Security Policy violation for each
 * one (nothing runs, but the console fills with errors). Only tags are touched, never the text
 * between them.
 */
export const stripInlineHandlers = (html: string) =>
  html.replace(/<[a-z][^<>]*>/gi, (tag) => tag.replace(HANDLER_ATTR, ''));
