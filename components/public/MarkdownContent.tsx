'use client'

import { useEffect, useState } from 'react'
import { renderMarkdown } from '@/lib/markdown'

interface MarkdownContentProps {
  md: string
  className?: string
}

/**
 * Render sanitized Markdown into a `<div>`. Sanitization is deferred to a
 * client-side effect so DOMPurify never runs on the SSR Node path; the
 * initial server render emits an empty container and hydrates with HTML
 * after mount.
 *
 * @param md        Raw Markdown string.
 * @param className Optional class applied to the wrapper `<div>`.
 */
export function MarkdownContent({ md, className }: MarkdownContentProps) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    setHtml(renderMarkdown(md))
  }, [md])

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
