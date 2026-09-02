import {
  isEmailThreadPayload,
  isSatisfactionPayload,
  type EmailThreadRealtimePayload,
  type SatisfactionSurveyRealtimePayload,
  type FormationSessionRealtimePayload,
  type RealtimePayload,
} from './realtime-payloads'

describe('realtime-payloads', () => {
  describe('isEmailThreadPayload', () => {
    it('returns true for a valid email thread payload', () => {
      const payload: EmailThreadRealtimePayload = {
        id: 'thread-1',
        subject: 'Subject',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T11:00:00Z',
        last_message_date: '2024-01-01T11:00:00Z',
        unread_count: 2,
        message_count: 5,
        is_spam: false,
        is_deleted: false,
        is_archived: false,
        is_sent: false,
        category: 'inbox',
        priority: 'high',
        etablissement_id: 'eta-1',
        partenaire_id: 'part-1',
        groupe_id: 'grp-1',
        account_id: 'acc-1',
      }

      expect(isEmailThreadPayload(payload)).toBe(true)
    })

    it('returns true when only required checked fields are present', () => {
      const payload = {
        id: 'thread-2',
        created_at: '2024-01-02T10:00:00Z',
        unread_count: 0,
      }

      expect(isEmailThreadPayload(payload)).toBe(true)
    })

    it('returns false for null', () => {
      expect(isEmailThreadPayload(null)).toBe(false)
    })

    it('returns false for primitive values', () => {
      expect(isEmailThreadPayload('x')).toBe(false)
      expect(isEmailThreadPayload(42)).toBe(false)
      expect(isEmailThreadPayload(false)).toBe(false)
      expect(isEmailThreadPayload(undefined)).toBe(false)
    })

    it('returns false when id is missing', () => {
      const payload = {
        created_at: '2024-01-01T10:00:00Z',
        unread_count: 1,
      }

      expect(isEmailThreadPayload(payload)).toBe(false)
    })

    it('returns false when created_at is missing', () => {
      const payload = {
        id: 'thread-3',
        unread_count: 1,
      }

      expect(isEmailThreadPayload(payload)).toBe(false)
    })

    it('returns false when unread_count is missing', () => {
      const payload = {
        id: 'thread-4',
        created_at: '2024-01-01T10:00:00Z',
      }

      expect(isEmailThreadPayload(payload)).toBe(false)
    })

    it('accepts a realtime payload new record containing an email thread payload', () => {
      const emailThread: EmailThreadRealtimePayload = {
        id: 'thread-5',
        subject: 'Realtime',
        created_at: '2024-02-01T08:00:00Z',
        updated_at: '2024-02-01T08:30:00Z',
        last_message_date: null,
        unread_count: 4,
        message_count: 7,
        is_spam: false,
        is_deleted: false,
        is_archived: true,
        is_sent: false,
        category: null,
        priority: null,
        etablissement_id: null,
        partenaire_id: null,
        groupe_id: null,
        account_id: 'acc-2',
      }

      const realtimePayload: RealtimePayload<EmailThreadRealtimePayload> = {
        commit_timestamp: '2024-02-01T08:31:00Z',
        eventType: 'UPDATE',
        new: emailThread,
        old: null,
        schema: 'public',
        table: 'email_threads',
      }

      expect(realtimePayload.eventType).toBe('UPDATE')
      expect(realtimePayload.table).toBe('email_threads')
      expect(isEmailThreadPayload(realtimePayload.new)).toBe(true)
    })
  })

  describe('isSatisfactionPayload', () => {
    it('returns true for a valid satisfaction survey payload', () => {
      const payload: SatisfactionSurveyRealtimePayload = {
        id: 'survey-1',
        etablissement_id: 'eta-1',
        created_at: '2024-03-01T09:00:00Z',
        note_globale: 9,
        commentaire: 'Très bien',
      }

      expect(isSatisfactionPayload(payload)).toBe(true)
    })

    it('returns true when only required checked fields are present', () => {
      const payload = {
        id: 'survey-2',
        etablissement_id: 'eta-2',
      }

      expect(isSatisfactionPayload(payload)).toBe(true)
    })

    it('returns false for null', () => {
      expect(isSatisfactionPayload(null)).toBe(false)
    })

    it('returns false for primitive values', () => {
      expect(isSatisfactionPayload('x')).toBe(false)
      expect(isSatisfactionPayload(0)).toBe(false)
      expect(isSatisfactionPayload(true)).toBe(false)
      expect(isSatisfactionPayload(undefined)).toBe(false)
    })

    it('returns false when id is missing', () => {
      const payload = {
        etablissement_id: 'eta-3',
        created_at: '2024-03-01T09:00:00Z',
      }

      expect(isSatisfactionPayload(payload)).toBe(false)
    })

    it('returns false when etablissement_id is missing', () => {
      const payload = {
        id: 'survey-3',
        created_at: '2024-03-01T09:00:00Z',
      }

      expect(isSatisfactionPayload(payload)).toBe(false)
    })

    it('accepts a realtime payload new record containing a satisfaction payload', () => {
      const survey: SatisfactionSurveyRealtimePayload = {
        id: 'survey-4',
        etablissement_id: 'eta-4',
        created_at: '2024-04-01T12:00:00Z',
        note_globale: 7,
        commentaire: null,
      }

      const realtimePayload: RealtimePayload<SatisfactionSurveyRealtimePayload> = {
        commit_timestamp: '2024-04-01T12:01:00Z',
        eventType: 'INSERT',
        new: survey,
        old: null,
        schema: 'public',
        table: 'satisfaction_surveys',
      }

      expect(realtimePayload.eventType).toBe('INSERT')
      expect(realtimePayload.table).toBe('satisfaction_surveys')
      expect(isSatisfactionPayload(realtimePayload.new)).toBe(true)
    })
  })

  describe('type compatibility coverage', () => {
    it('supports other realtime payload shapes through the generic type', () => {
      const formationSession: FormationSessionRealtimePayload = {
        id: 'session-1',
        etablissement_id: 'eta-9',
        created_at: '2024-05-10T14:00:00Z',
        statut: 'planifiee',
        date_session: '2024-06-01',
      }

      const payload: RealtimePayload<FormationSessionRealtimePayload> = {
        commit_timestamp: '2024-05-10T14:01:00Z',
        eventType: 'DELETE',
        new: null,
        old: formationSession,
        schema: 'public',
        table: 'formation_sessions',
      }

      expect(payload.eventType).toBe('DELETE')
      expect(payload.old?.statut).toBe('planifiee')
      expect(payload.old?.date_session).toBe('2024-06-01')
      expect(payload.new).toBeNull()
    })
  })
})