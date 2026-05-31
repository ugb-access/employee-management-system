'use client'

import { sanitizeHtml } from '@/lib/sanitize'

interface TermsViewProps {
  content: string
  className?: string
}

/**
 * Renders Terms & Policies HTML as safe text. Content is sanitized again on
 * the client (defense in depth) before being injected into the DOM.
 */
export function TermsView({ content, className }: TermsViewProps) {
  return (
    <div
      className={`terms-content ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
    />
  )
}
