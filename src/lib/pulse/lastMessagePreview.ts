import type { PulseConversation } from '@/types/pulse'

type LastMessagePreviewSource = {
  content?: string | null
  user_id?: string | null
  created_at?: string | null
  user?: { prenom?: string | null; nom?: string | null } | null
}

export function getNormalizedLastMessage(
  conversation: PulseConversation
): LastMessagePreviewSource | null {
  const rawLastMessage = conversation.last_message as
    | LastMessagePreviewSource
    | LastMessagePreviewSource[]
    | null
    | undefined

  if (!rawLastMessage) return null

  if (Array.isArray(rawLastMessage)) {
    if (rawLastMessage.length === 0) return null

    return (
      [...rawLastMessage].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )[0] ?? null
    )
  }

  return rawLastMessage
}

/**
 * Returns a short preview of the last message in a conversation,
 * to be displayed under the conversation name in the list.
 */
export function getLastMessagePreview(
  conversation: PulseConversation,
  myProfileId: string | null | undefined,
  isDM: boolean
): string | null {
  const lastMessage = getNormalizedLastMessage(conversation)

  if (!lastMessage) return null

  const rawContent = (lastMessage.content || '').trim()

  // Fallback labels when message has no textual content (attachments, polls, etc.)
  let body = rawContent
  if (!body) {
    body = '📎 Pièce jointe'
  }

  // Strip markdown / mentions crudely for a preview
  body = body
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '🖼️ Image')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\n+/g, ' ')
    .trim()

  if (body.length > 120) body = body.slice(0, 120) + '…'

  const isMine = !!myProfileId && lastMessage.user_id === myProfileId

  if (isDM) {
    return isMine ? `Vous : ${body}` : body
  }

  // For rooms, prefix with author first name
  if (isMine) return `Vous : ${body}`

  const prenom = lastMessage.user?.prenom?.trim()
  if (prenom) return `${prenom} : ${body}`

  return body
}
