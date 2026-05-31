import DOMPurify from 'isomorphic-dompurify'

/**
 * Tags/attributes we allow in the Terms & Policies rich-text content.
 * Kept intentionally small — only what the WYSIWYG editor can produce —
 * so stored content can never contain scripts, event handlers, iframes, etc.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre',
  'blockquote',
  'ul', 'ol', 'li',
  'a', 'span',
]

const ALLOWED_ATTR = ['href', 'target', 'rel']

/**
 * Sanitize untrusted HTML into safe markup for storage and rendering.
 * Used on the server before persisting and on the client before rendering,
 * so the terms are always rendered as safe text.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Force links to be safe if any ever sneak in
    ADD_ATTR: ['target'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  })
}
