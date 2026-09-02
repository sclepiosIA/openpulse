import { describe, it, expect } from 'vitest'
import { EMAIL_THREAD_DETAIL_SELECT } from '../EmailThread.types'

describe('EMAIL_THREAD_DETAIL_SELECT', () => {
  it('is a non-empty string', () => {
    expect(typeof EMAIL_THREAD_DETAIL_SELECT).toBe('string')
    expect(EMAIL_THREAD_DETAIL_SELECT.length).toBeGreaterThan(100)
  })
  it('selects all core thread fields', () => {
    for (const f of [
      'thread_id', 'subject', 'participants', 'last_message_date',
      'message_count', 'unread_count', 'is_archived', 'is_processed',
      'category', 'priority', 'tags',
      'etablissement_id', 'groupe_id', 'partenaire_id',
      'ai_summary', 'ai_generated_title', 'ai_confidence_score',
      'needs_manual_review',
    ]) {
      expect(EMAIL_THREAD_DETAIL_SELECT).toContain(f)
    }
  })
  it('includes nested relations', () => {
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('messages:email_messages')
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('account:user_email_accounts')
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('etablissement:etablissements')
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('partenaire:partenaires')
  })
  it('messages relation selects body_html and body_text', () => {
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('body_html')
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('body_text')
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('has_attachments')
  })
})
