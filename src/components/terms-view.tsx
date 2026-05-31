'use client'

interface TermsViewProps {
  content: string
  className?: string
}

/**
 * Renders Terms & Policies HTML.
 *
 * The content reaching this component is always safe: stored content is
 * sanitized on the server before persisting (PUT) and again when read (GET),
 * and the auto-generated default document is produced from our own trusted
 * template. The server is the authoritative sanitization point, so we don't
 * pull a sanitizer (and its dependencies) into the client bundle here.
 */
export function TermsView({ content, className }: TermsViewProps) {
  return (
    <div
      className={`terms-content ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
