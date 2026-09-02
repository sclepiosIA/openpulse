import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MENTIONS_LEGALES_MD } from '@/content/legal'

/**
 * Page publique « Mentions légales » (LCEN) — servie sur /mentions-legales.
 * Contenu : src/content/legal.ts (CONF-01, audit 2026-06-02).
 */
export default function MentionsLegales() {
  useEffect(() => {
    document.title = 'Mentions légales — OpenPulse'
  }, [])

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <article className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{MENTIONS_LEGALES_MD}</ReactMarkdown>
      </article>
    </main>
  )
}
