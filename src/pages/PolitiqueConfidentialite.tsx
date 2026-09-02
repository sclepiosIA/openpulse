import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { POLITIQUE_CONFIDENTIALITE_MD } from '@/content/legal'

/**
 * Page publique « Politique de confidentialité » (RGPD) — servie sur /politique-confidentialite.
 * Contenu : src/content/legal.ts (CONF-01, audit 2026-06-02).
 */
export default function PolitiqueConfidentialite() {
  useEffect(() => {
    document.title = 'Politique de confidentialité — OpenPulse'
  }, [])

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <article className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{POLITIQUE_CONFIDENTIALITE_MD}</ReactMarkdown>
      </article>
    </main>
  )
}
