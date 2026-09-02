import { supabase } from '@/integrations/supabase/client'
import { debug } from '@/lib/debug'

interface DraftData {
  user_id: string
  account_id: string
  to_addresses: string
  cc_addresses: string
  bcc_addresses: string
  subject: string
  body: string
  attachments: Array<{ name: string; size: number; type: string }>
}

/**
 * Draft management actions for EmailComposer.
 * Extracted from component to separate data access from UI.
 */
export function useEmailDraftActions() {
  const saveDraft = async (
    draftId: string | null,
    draftData: DraftData
  ): Promise<string | null> => {
    // Guard: don't save empty drafts
    const hasContent =
      draftData.to_addresses?.trim() ||
      draftData.subject?.trim() ||
      (draftData.body?.trim() && draftData.body.trim() !== '<p></p>')
    if (!hasContent) return draftId

    if (draftId) {
      await supabase.from('email_drafts').update(draftData).eq('id', draftId)
      return draftId
    } else {
      const { data, error } = await supabase
        .from('email_drafts')
        .insert(draftData)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (data && !error) {
        return data.id
      }
      return null
    }
  }

  const deleteDraft = async (draftId: string) => {
    await supabase.from('email_drafts').delete().eq('id', draftId)
  }

  const createOutboundThread = async (params: {
    threadId: string
    accountId: string
    subject: string
    participants: Array<{ email: string; name: string | null; type: string }>
  }) => {
    const { data, error } = await supabase
      .from('email_threads')
      .insert({
        thread_id: params.threadId,
        user_email_account_id: params.accountId,
        subject: params.subject,
        participants: params.participants,
        last_message_date: new Date().toISOString(),
        message_count: 0,
        unread_count: 0,
        has_sent_messages: true,
        is_outbound: true,
      })
      .select('id')
      // safe: guaranteed-row
      .single() // safe: guaranteed-row

    if (error) {
      debug.error('Failed to create thread:', error)
      throw new Error('Impossible de créer le fil de discussion')
    }

    return data
  }

  const deleteOrphanThread = async (threadId: string) => {
    await supabase.from('email_threads').delete().eq('id', threadId).eq('message_count', 0)
  }

  const deleteThread = async (threadId: string) => {
    await supabase.from('email_threads').delete().eq('id', threadId)
  }

  return { saveDraft, deleteDraft, createOutboundThread, deleteOrphanThread, deleteThread }
}
