import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";

import type { Json } from '@/integrations/supabase/types';

/** Type pour une pièce jointe email */
export interface EmailAttachment {
  name: string;
  size: number;
  type: string;
  url?: string;
  storage_path?: string;
  [key: string]: Json | undefined; // Allow indexing for Json compatibility
}

interface DraftData {
  to_addresses: string;
  cc_addresses: string;
  bcc_addresses: string;
  subject: string;
  body: string;
  attachments: EmailAttachment[];
}

export function useEmailDraft(accountId: string) {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const saveDraft = async (data: DraftData, userId?: string) => {
    if (!data.to_addresses && !data.subject && !data.body) return;
    if (!userId) return;

    setIsSaving(true);
    try {
      const draftData = {
        user_id: userId,
        account_id: accountId,
        ...data,
      };

      if (draftId) {
        await supabase
          .from('email_drafts')
          .update(draftData)
          .eq('id', draftId);
      } else {
        const { data: newDraft, error } = await supabase
          .from('email_drafts')
          .insert(draftData)
          .select()
          .maybeSingle();

        if (newDraft && !error) {
          setDraftId(newDraft.id);
        }
      }
    } catch (error) {
      debug.error('Auto-save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDraft = async () => {
    if (draftId) {
      await supabase.from('email_drafts').delete().eq('id', draftId);
      setDraftId(null);
    }
  };

  const loadDraft = async (id: string) => {
    const { data } = await supabase
      .from('email_drafts')
      .select('id, user_id, account_id, to_addresses, cc_addresses, bcc_addresses, subject, body, attachments, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    return data ?? null;
  };

  return {
    draftId,
    isSaving,
    saveDraft,
    deleteDraft,
    loadDraft,
  };
}
