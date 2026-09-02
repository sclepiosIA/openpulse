/* @vitest-environment jsdom */

import { getLastMessagePreview, getNormalizedLastMessage } from './lastMessagePreview'
import type { PulseConversation } from '@/types/pulse'

describe('lastMessagePreview', () => {
  describe('getNormalizedLastMessage', () => {
    it('returns null when last_message is null or undefined', () => {
      const withNull = { last_message: null } as PulseConversation
      const withUndefined = {} as PulseConversation

      expect(getNormalizedLastMessage(withNull)).toBeNull()
      expect(getNormalizedLastMessage(withUndefined)).toBeNull()
    })

    it('returns null when last_message is an empty array', () => {
      const conversation = {
        last_message: [],
      } as PulseConversation

      expect(getNormalizedLastMessage(conversation)).toBeNull()
    })

    it('returns the object directly when last_message is a single object', () => {
      const message = {
        content: 'Bonjour',
        user_id: 'u1',
        created_at: '2024-01-01T10:00:00.000Z',
        user: { prenom: 'Lina', nom: 'Doe' },
      }

      const conversation = {
        last_message: message,
      } as PulseConversation

      expect(getNormalizedLastMessage(conversation)).toEqual(message)
    })

    it('returns the most recent message when last_message is an array', () => {
      const oldest = {
        content: 'Premier',
        user_id: 'u1',
        created_at: '2024-01-01T10:00:00.000Z',
        user: { prenom: 'Alice' },
      }
      const latest = {
        content: 'Dernier',
        user_id: 'u2',
        created_at: '2024-01-01T12:00:00.000Z',
        user: { prenom: 'Bob' },
      }
      const middle = {
        content: 'Milieu',
        user_id: 'u3',
        created_at: '2024-01-01T11:00:00.000Z',
        user: { prenom: 'Chloé' },
      }

      const conversation = {
        last_message: [oldest, latest, middle],
      } as PulseConversation

      expect(getNormalizedLastMessage(conversation)).toEqual(latest)
    })

    it('handles missing created_at by treating it as oldest date', () => {
      const noDate = {
        content: 'Sans date',
        user_id: 'u1',
        user: { prenom: 'NoDate' },
      }
      const withDate = {
        content: 'Avec date',
        user_id: 'u2',
        created_at: '2024-02-03T09:00:00.000Z',
        user: { prenom: 'Dated' },
      }

      const conversation = {
        last_message: [noDate, withDate],
      } as PulseConversation

      expect(getNormalizedLastMessage(conversation)).toEqual(withDate)
    })

    it('does not mutate the original array order', () => {
      const first = {
        content: 'Ancien',
        created_at: '2024-01-01T09:00:00.000Z',
      }
      const second = {
        content: 'Récent',
        created_at: '2024-01-01T10:00:00.000Z',
      }

      const original = [first, second]
      const conversation = {
        last_message: original,
      } as PulseConversation

      const result = getNormalizedLastMessage(conversation)

      expect(result).toEqual(second)
      expect(original).toEqual([first, second])
    })
  })

  describe('getLastMessagePreview', () => {
    it('returns null when there is no last message', () => {
      const conversation = { last_message: null } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', true)).toBeNull()
      expect(getLastMessagePreview(conversation, 'me', false)).toBeNull()
    })

    it('returns plain body for a DM received from someone else', () => {
      const conversation = {
        last_message: {
          content: ' Salut à toi ',
          user_id: 'other',
          created_at: '2024-01-01T10:00:00.000Z',
          user: { prenom: 'Marie' },
        },
      } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', true)).toBe('Salut à toi')
    })

    it('prefixes "Vous :" for a DM sent by me', () => {
      const conversation = {
        last_message: {
          content: 'On se parle plus tard',
          user_id: 'me',
          created_at: '2024-01-01T10:00:00.000Z',
        },
      } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', true)).toBe('Vous : On se parle plus tard')
    })

    it('prefixes first name in a room when message is from another user', () => {
      const conversation = {
        last_message: {
          content: 'Le point est validé',
          user_id: 'u2',
          created_at: '2024-01-01T10:00:00.000Z',
          user: { prenom: 'Sofia', nom: 'Martin' },
        },
      } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', false)).toBe('Sofia : Le point est validé')
    })

    it('prefixes "Vous :" in a room when message is mine', () => {
      const conversation = {
        last_message: {
          content: 'Je m’en occupe',
          user_id: 'me',
          created_at: '2024-01-01T10:00:00.000Z',
          user: { prenom: 'Moi' },
        },
      } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', false)).toBe('Vous : Je m’en occupe')
    })

    it('falls back to body only in a room when first name is missing', () => {
      const conversation = {
        last_message: {
          content: 'Message sans prénom',
          user_id: 'u9',
          created_at: '2024-01-01T10:00:00.000Z',
          user: { prenom: '   ' },
        },
      } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', false)).toBe('Message sans prénom')
    })

    it('uses attachment fallback when content is empty or whitespace', () => {
      const conversation = {
        last_message: {
          content: '   ',
          user_id: 'u2',
          created_at: '2024-01-01T10:00:00.000Z',
          user: { prenom: 'Nora' },
        },
      } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', true)).toBe('📎 Pièce jointe')
      expect(getLastMessagePreview(conversation, 'me', false)).toBe('Nora : 📎 Pièce jointe')
    })

    it('replaces markdown image syntax with image label', () => {
      const conversation = {
        last_message: {
          content: 'Voici ![aperçu](img-url)',
          user_id: 'u2',
          created_at: '2024-01-01T10:00:00.000Z',
        },
      } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', true)).toBe('Voici 🖼️ Image')
    })

    it('converts markdown links to their visible text', () => {
      const conversation = {
        last_message: {
          content: 'Lire [la doc](page-url) maintenant',
          user_id: 'u2',
          created_at: '2024-01-01T10:00:00.000Z',
        },
      } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', true)).toBe('Lire la doc maintenant')
    })

    it('strips simple markdown formatting characters and collapses newlines', () => {
      const conversation = {
        last_message: {
          content: '*Bonjour* _à_\n\ntous `ici` ~vite~',
          user_id: 'u2',
          created_at: '2024-01-01T10:00:00.000Z',
        },
      } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', true)).toBe('Bonjour à tous ici vite')
    })

    it('truncates previews longer than 120 characters with an ellipsis', () => {
      const longText = 'a'.repeat(121)
      const conversation = {
        last_message: {
          content: longText,
          user_id: 'u2',
          created_at: '2024-01-01T10:00:00.000Z',
        },
      } as PulseConversation

      const preview = getLastMessagePreview(conversation, 'me', true)

      expect(preview).toBe(`${'a'.repeat(120)}…`)
      expect(preview?.length).toBe(121)
    })

    it('uses the most recent message from an array for preview generation', () => {
      const conversation = {
        last_message: [
          {
            content: 'Ancien message',
            user_id: 'u1',
            created_at: '2024-01-01T09:00:00.000Z',
            user: { prenom: 'Paul' },
          },
          {
            content: 'Message récent',
            user_id: 'u2',
            created_at: '2024-01-01T11:00:00.000Z',
            user: { prenom: 'Emma' },
          },
        ],
      } as PulseConversation

      expect(getLastMessagePreview(conversation, 'me', false)).toBe('Emma : Message récent')
    })

    it('does not mark as mine when myProfileId is null or undefined', () => {
      const conversation = {
        last_message: {
          content: 'Mon propre message',
          user_id: 'me',
          created_at: '2024-01-01T10:00:00.000Z',
          user: { prenom: 'Camille' },
        },
      } as PulseConversation

      expect(getLastMessagePreview(conversation, null, true)).toBe('Mon propre message')
      expect(getLastMessagePreview(conversation, undefined, false)).toBe(
        'Camille : Mon propre message'
      )
    })
  })
})
