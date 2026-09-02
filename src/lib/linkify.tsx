import React from 'react'

// Détecte URLs http(s)://, www., et adresses email
const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)"'\]]|[\w.+-]+@[\w-]+\.[\w.-]+)/gi

/**
 * Transforme un texte brut en fragments React où les URLs et emails
 * deviennent des liens cliquables. À utiliser dans tous les rendus de
 * contenu utilisateur (messages Pulse, notes, commentaires, etc.).
 */
export function linkify(text: string | null | undefined): React.ReactNode[] {
  if (!text) return []
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(URL_REGEX)
  let i = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const raw = match[0]
    const isEmail = raw.includes('@') && !raw.startsWith('http') && !raw.startsWith('www.')
    const href = isEmail ? `mailto:${raw}` : raw.startsWith('http') ? raw : `https://${raw}`
    parts.push(
      <a
        key={`lnk-${i++}-${match.index}`}
        href={href}
        target={isEmail ? undefined : '_blank'}
        rel={isEmail ? undefined : 'noopener noreferrer'}
        className="text-blue-600 hover:underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {raw}
      </a>
    )
    lastIndex = match.index + raw.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

/**
 * Composant pratique : `<Linkify>{text}</Linkify>`
 */
export function Linkify({ children }: { children: string | null | undefined }) {
  return <>{linkify(children)}</>
}
