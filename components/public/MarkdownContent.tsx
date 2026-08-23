'use client'

import { useEffect, useRef, useState } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { ImageLightbox } from './ImageLightbox'
import {
  collectPostImages,
  indexOfImage,
  type LightboxSlide,
} from '@/lib/lightbox-slides'
import { useRestoreFocus } from '@/lib/use-restore-focus'

interface MarkdownContentProps {
  md: string
  className?: string
  /**
   * Names this post in the full-screen viewer's assistive-technology
   * strings. Defaults to a phrase rather than a title so a caller that has
   * no title still produces a readable label.
   */
  imageLabel?: string
}

/**
 * Render sanitized Markdown into a `<div>`. Sanitization is deferred to a
 * client-side effect so DOMPurify never runs on the SSR Node path; the
 * initial server render emits an empty container and hydrates with HTML
 * after mount.
 *
 * Clicking a body image opens the full-screen viewer (T48) on the images of
 * this post alone. The slide list is built when the click is handled, not on
 * mount: the `<img>` nodes are injected by the effect below and do not exist
 * during the first render.
 *
 * @param md         Raw Markdown string.
 * @param className  Optional class applied to the wrapper `<div>`.
 * @param imageLabel Group name used in the viewer's aria labels.
 */
export function MarkdownContent({
  md,
  className,
  imageLabel = 'this post',
}: MarkdownContentProps) {
  const [html, setHtml] = useState('')
  const [slides, setSlides] = useState<LightboxSlide[]>([])
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHtml(renderMarkdown(md))
  }, [md])

  const rememberOpener = useRestoreFocus(
    openIndex !== null,
    (sourceIndex) => containerRef.current?.querySelectorAll('img')[sourceIndex],
  )

  function onClick(event: React.MouseEvent<HTMLDivElement>) {
    const container = containerRef.current
    if (!container) return
    const index = indexOfImage(container, event.target)
    if (index === null) return
    // Prose images are not focusable; the clicked one is given a programmatic
    // focus target so focus can come back to it when the viewer closes.
    const image = event.target as HTMLElement
    image.tabIndex = -1
    image.focus()
    const postSlides = collectPostImages(container)
    rememberOpener(postSlides[index].sourceIndex)
    setSlides(postSlides)
    setOpenIndex(index)
  }

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {openIndex !== null && (
        <ImageLightbox
          slides={slides}
          startIndex={openIndex}
          label={imageLabel}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  )
}
