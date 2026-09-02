import { sanitizeDisplayName } from './emailUtils';

/**
 * Extrait l'expéditeur principal d'un thread email
 * @param thread - Le thread email avec ses participants
 * @param userEmail - L'adresse email de l'utilisateur (pour l'exclure)
 * @returns Le nom et l'email du principal expéditeur externe
 */
interface EmailAddressLite {
  email: string
  name?: string | null
}

type AddressEntry = string | EmailAddressLite | null | undefined

interface ThreadMessageLite {
  from_address?: string | null
  from_name?: string | null
  sent_date?: string | null
  to_addresses?: AddressEntry[] | null
  cc_addresses?: AddressEntry[] | null
}

function toAddressLite(addr: AddressEntry): EmailAddressLite | null {
  if (!addr) return null
  if (typeof addr === 'string') return { email: addr }
  if (typeof addr === 'object' && typeof addr.email === 'string') return addr
  return null
}

// Note: signature publique permissive (`unknown`) car les types globaux
// EmailThread/EmailMessage exposent `to_addresses: string[]` mais la réalité
// runtime mélange string et { email, name }. Narrowing fait à l'intérieur.
export function getThreadMainSender(
  thread: unknown,
  userEmail: string
): { name: string; email: string; isCurrentUser?: boolean } | null {
  const t = (thread ?? {}) as {
    messages?: ThreadMessageLite[]
    participants?: EmailAddressLite[]
    last_message_from_email?: string | null
    last_message_from_name?: string | null
    last_message_is_sent?: boolean | null
  }

  const messages = [...(t.messages || [])].sort((a, b) => {
    const dateA = a.sent_date ? new Date(a.sent_date).getTime() : 0
    const dateB = b.sent_date ? new Date(b.sent_date).getTime() : 0
    return dateA - dateB
  })

  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1]
    const fromEmail = lastMessage.from_address

    if (fromEmail?.toLowerCase() === userEmail?.toLowerCase()) {
      const toAddresses = (lastMessage.to_addresses || [])
        .map(toAddressLite)
        .filter((a): a is EmailAddressLite => a !== null)
      if (toAddresses.length > 0) {
        return {
          name: sanitizeDisplayName(toAddresses[0].name) || toAddresses[0].email.split('@')[0],
          email: toAddresses[0].email,
          isCurrentUser: true,
        }
      }
    }

    return {
      name: sanitizeDisplayName(lastMessage.from_name) || fromEmail?.split('@')[0] || 'Inconnu',
      email: fromEmail || '',
      isCurrentUser: false,
    }
  }

  // Fallback dénormalisé: dernier expéditeur stocké directement sur le thread
  // (utilisé par les listes qui ne chargent pas les messages)
  if (t.last_message_from_email) {
    const lastFromEmail = t.last_message_from_email
    const isFromMe = lastFromEmail.toLowerCase() === userEmail?.toLowerCase()

    if (isFromMe || t.last_message_is_sent) {
      // Dernier message envoyé par l'utilisateur: afficher le premier
      // destinataire externe trouvé dans les participants
      const externalParticipants = (t.participants || []).filter(
        (p) => p.email?.toLowerCase() !== userEmail?.toLowerCase()
      )
      if (externalParticipants.length > 0) {
        const participant = externalParticipants[0]
        return {
          name: sanitizeDisplayName(participant.name) || participant.email.split('@')[0],
          email: participant.email,
          isCurrentUser: true,
        }
      }
    }

    return {
      name:
        sanitizeDisplayName(t.last_message_from_name) || lastFromEmail.split('@')[0] || 'Inconnu',
      email: lastFromEmail,
      isCurrentUser: false,
    }
  }

  if (t.participants && Array.isArray(t.participants)) {
    const externalParticipants = t.participants.filter(
      (p) => p.email?.toLowerCase() !== userEmail?.toLowerCase()
    )

    if (externalParticipants.length > 0) {
      const participant = externalParticipants[0]
      return {
        name: sanitizeDisplayName(participant.name) || participant.email.split('@')[0],
        email: participant.email,
        isCurrentUser: false,
      }
    }
  }

  return null
}

/**
 * Extract all participants (TO and CC) from a thread, excluding the current user
 */
export function getAllThreadParticipants(
  thread: unknown,
  myEmailAddress: string
): {
  to: string[]
  cc: string[]
  all: Array<{ email: string; name?: string }>
} {
  const t = (thread ?? {}) as { messages?: ThreadMessageLite[] }
  const toParticipants = new Set<string>()
  const ccParticipants = new Set<string>()
  const allParticipantsMap = new Map<string, { email: string; name?: string }>()

  const myEmail = myEmailAddress.toLowerCase()

  t.messages?.forEach((msg) => {
    if (msg.from_address && msg.from_address.toLowerCase() !== myEmail) {
      toParticipants.add(msg.from_address)
      if (!allParticipantsMap.has(msg.from_address.toLowerCase())) {
        allParticipantsMap.set(msg.from_address.toLowerCase(), {
          email: msg.from_address,
          name: msg.from_name || undefined,
        })
      }
    }

    const handle = (rawList: AddressEntry[] | null | undefined, target: Set<string>) => {
      rawList?.forEach((raw) => {
        const addr = toAddressLite(raw)
        if (addr && addr.email && addr.email.toLowerCase() !== myEmail) {
          target.add(addr.email)
          if (!allParticipantsMap.has(addr.email.toLowerCase())) {
            allParticipantsMap.set(addr.email.toLowerCase(), {
              email: addr.email,
              name: addr.name || undefined,
            })
          }
        }
      })
    }

    handle(msg.to_addresses, toParticipants)
    handle(msg.cc_addresses, ccParticipants)
  })

  return {
    to: Array.from(toParticipants),
    cc: Array.from(ccParticipants),
    all: Array.from(allParticipantsMap.values()),
  }
}
