import sanitizeHtmlLib from 'sanitize-html'

/**
 * Tags/attributes we allow in the Terms & Policies rich-text content.
 * Kept intentionally small — only what the WYSIWYG editor can produce —
 * so stored content can never contain scripts, event handlers, iframes, etc.
 *
 * Uses `sanitize-html` (pure Node, no jsdom/DOM dependency) so it runs
 * reliably in serverless functions and during SSR as well as in the browser.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre',
  'blockquote',
  'ul', 'ol', 'li',
  'a', 'span',
]

/**
 * Sanitize untrusted HTML into safe markup for storage and rendering.
 * Used on the server before persisting and on the client before rendering,
 * so the terms are always rendered as safe text.
 */
export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    // Force safe link behavior
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank',
      }),
    },
  })
}
