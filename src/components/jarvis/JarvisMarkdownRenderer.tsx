/**
 * JarvisMarkdownRenderer - Composant Markdown unifié (v16.1)
 *
 * Centralise:
 * - Rendu Markdown avec remark-gfm
 * - Parsing et rendu des références d'entités [[type:UUID|titre]]
 * - Pré-traitement du contenu pour éviter que ReactMarkdown ne casse les références
 * - Styles cohérents pour titres, listes, tables, code, etc.
 */

import React, { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { JarvisEntityReference, type EntityType } from './JarvisEntityReference'

// Universal entity reference pattern
const ENTITY_REF_PATTERN =
  /\[\[(email|task|etablissement|ticket|event|contact):([a-f0-9-]+)\|([^\]]+)\]\]/g

// Placeholder pattern used after pre-processing
const PLACEHOLDER_PATTERN = /%%ENTITYREF_(\d+)%%/g

interface ExtractedRef {
  type: EntityType
  entityId: string
  title: string
}

/**
 * Pre-process content to replace [[entity:...]] with safe placeholders
 * so ReactMarkdown doesn't break them across child nodes.
 */
function extractEntityRefs(content: string): { processed: string; refs: ExtractedRef[] } {
  const refs: ExtractedRef[] = []
  ENTITY_REF_PATTERN.lastIndex = 0

  const processed = content.replace(ENTITY_REF_PATTERN, (_match, type, entityId, title) => {
    const index = refs.length
    refs.push({ type: type as EntityType, entityId, title })
    return `%%ENTITYREF_${index}%%`
  })

  return { processed, refs }
}

function renderWithPlaceholders(text: string, refs: ExtractedRef[]): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match
  let keyIndex = 0
  PLACEHOLDER_PATTERN.lastIndex = 0

  while ((match = PLACEHOLDER_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <React.Fragment key={`t-${keyIndex++}`}>
          {text.slice(lastIndex, match.index)}
        </React.Fragment>
      )
    }
    const refIndex = parseInt(match[1], 10)
    const ref = refs[refIndex]
    if (ref) {
      parts.push(
        <JarvisEntityReference
          key={`ref-${ref.type}-${ref.entityId}-${keyIndex++}`}
          type={ref.type}
          entityId={ref.entityId}
          title={ref.title}
        />
      )
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(<React.Fragment key={`t-${keyIndex++}`}>{text.slice(lastIndex)}</React.Fragment>)
  }

  return parts.length > 0 ? parts : [<React.Fragment key="c">{text}</React.Fragment>]
}

function processChildren(children: React.ReactNode, refs: ExtractedRef[]): React.ReactNode {
  if (!children || refs.length === 0) return children
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === 'string' && PLACEHOLDER_PATTERN.test(child)) {
        PLACEHOLDER_PATTERN.lastIndex = 0
        // safe: static markdown rendering, index is stable
        return (
          <React.Fragment key={`md-${i}`}>{renderWithPlaceholders(child, refs)}</React.Fragment>
        )
      }
      return child
    })
  }
  if (typeof children === 'string' && PLACEHOLDER_PATTERN.test(children)) {
    PLACEHOLDER_PATTERN.lastIndex = 0
    return <>{renderWithPlaceholders(children, refs)}</>
  }
  return children
}

interface JarvisMarkdownRendererProps {
  content: string
  className?: string
}

export const JarvisMarkdownRenderer = memo(function JarvisMarkdownRenderer({
  content,
  className,
}: JarvisMarkdownRendererProps) {
  const { processed, refs } = useMemo(() => extractEntityRefs(content), [content])

  return (
    <div
      className={cn(
        'prose prose-sm max-w-none',
        'prose-p:my-1.5 prose-p:leading-relaxed prose-p:text-foreground prose-p:text-[14px]',
        'prose-headings:font-semibold prose-headings:text-foreground',
        'prose-ul:my-1.5 prose-li:my-0.5 prose-li:text-foreground prose-li:text-[14px]',
        'prose-ol:my-1.5',
        'prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-mono prose-code:text-foreground',
        'prose-pre:bg-muted/80 prose-pre:backdrop-blur-sm prose-pre:rounded-xl prose-pre:border prose-pre:border-border/50',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:text-muted-foreground',
        '[&>p:first-child]:mt-0 [&>p:last-child]:mb-0',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed text-[14px] text-foreground">
              {processChildren(children, refs)}
            </p>
          ),
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-primary mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-primary mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-primary mt-2 mb-1">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="my-2 ml-4 space-y-1 list-none [&>li]:relative [&>li]:before:content-['•'] [&>li]:before:absolute [&>li]:before:-left-4 [&>li]:before:text-primary [&>li]:before:font-bold">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-4 space-y-1 list-decimal marker:text-primary marker:font-semibold">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1 text-[14px]">{processChildren(children, refs)}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-primary">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded-md text-[13px] font-mono bg-muted/80 border border-border/30 text-foreground">
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-border/50" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-4 my-2 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-border/50">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold bg-muted/50 border-b border-border/50 text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 border-b border-border/30 text-foreground">
              {processChildren(children, refs)}
            </td>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
})
