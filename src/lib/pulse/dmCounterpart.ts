/**
 * Utility to robustly get the DM counterpart (other participant) in a DM conversation
 * Uses auth user id for identification, never assumes order of participants
 */

import type { PulseConversation, PulseConversationMember } from '@/types/pulse';

interface ProfileMinimal {
  id: string;
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

/**
 * Check if a conversation is a DM (direct message between 2 people)
 */
export function isDMConversation(conversation: PulseConversation): boolean {
  const metadata = conversation.metadata as Record<string, unknown> | null;
  return metadata?.type === 'dm';
}

/**
 * Get the other participant in a DM conversation
 * @param conversation - The conversation object with members loaded
 * @param myProfileId - The current user's PROFILE ID (from useCurrentProfile().id, NOT auth user.id)
 * @param myFullName - Optional: current user's full name for fallback matching
 * @param myEmail - Optional: current user's email for fallback matching (most reliable)
 * @returns The profile of the other participant, or null if not found
 * 
 * IMPORTANT: pulse_conversation_members.user_id contains profiles.id, not auth.users.id!
 * Always pass the profile ID, not the auth user ID.
 */
export function getDmCounterpart(
  conversation: PulseConversation,
  myProfileId?: string | null,
  myFullName?: string | null,
  myEmail?: string | null
): ProfileMinimal | null {
  if (!isDMConversation(conversation)) return null;
  
  const members = conversation.members;
  if (!members || members.length === 0) return null;
  
  // Primary method: If we have the profile ID, find the other member directly
  if (myProfileId) {
    // Find my member by matching user_id (which is profile.id)
    const myMember = members.find(m => m.user_id === myProfileId);
    
    if (myMember) {
      // Find the other member
      const otherMember = members.find(m => m.user_id !== myProfileId);
      return otherMember?.user as ProfileMinimal || null;
    }
  }
  
  // Fallback 1: If we have myEmail, match by email (most reliable without profileId)
  if (myEmail && members.length === 2) {
    const normalizedMyEmail = myEmail.toLowerCase().trim();
    
    const myMemberByEmail = members.find(m => {
      if (!m.user) return false;
      return m.user.email?.toLowerCase().trim() === normalizedMyEmail;
    });
    
    if (myMemberByEmail) {
      const otherMember = members.find(m => m.user_id !== myMemberByEmail.user_id);
      return otherMember?.user as ProfileMinimal || null;
    }
  }
  
  // Fallback 2: If we have myFullName but no myProfileId/myEmail, match by name
  if (myFullName && members.length === 2) {
    const normalizedMyName = myFullName.toLowerCase().trim();
    
    const myMemberByName = members.find(m => {
      if (!m.user) return false;
      const memberFullName = `${m.user.prenom || ''} ${m.user.nom || ''}`.toLowerCase().trim();
      return memberFullName === normalizedMyName;
    });
    
    if (myMemberByName) {
      const otherMember = members.find(m => m.user_id !== myMemberByName.user_id);
      return otherMember?.user as ProfileMinimal || null;
    }
  }
  
  // Fallback 3: Use metadata.participants to find the counterpart
  const metadata = conversation.metadata as Record<string, unknown> | null;
  const participants = metadata?.participants as string[] | undefined;
  
  if (participants && participants.length === 2 && members.length === 2) {
    // If we have myProfileId, find which participant ID matches
    if (myProfileId) {
      const myParticipantId = participants.find(p => p === myProfileId);
      if (myParticipantId) {
        const otherParticipantId = participants.find(p => p !== myProfileId);
        const otherMember = members.find(m => m.user_id === otherParticipantId);
        return otherMember?.user as ProfileMinimal || null;
      }
    }
  }
  
  // Fallback 4: If conversation name contains "&", try to extract other person
  if (myFullName && conversation.name && conversation.name.includes(' & ')) {
    const otherName = extractOtherNameFromConversationName(conversation.name, myFullName);
    if (otherName !== conversation.name) {
      // Find member whose name matches otherName
      const otherMember = members.find(m => {
        if (!m.user) return false;
        const memberFullName = `${m.user.prenom || ''} ${m.user.nom || ''}`.trim();
        return memberFullName.toLowerCase() === otherName.toLowerCase();
      });
      if (otherMember?.user) {
        return otherMember.user as ProfileMinimal;
      }
    }
  }
  
  // Last resort for 2-member DMs: Return the member that is NOT the current user
  // If we still can't determine, return the first member with user data that seems like "the other"
  if (members.length === 2) {
    // If myProfileId is available, exclude self
    if (myProfileId) {
      const otherMember = members.find(m => m.user_id !== myProfileId && m.user);
      if (otherMember?.user) {
        return otherMember.user as ProfileMinimal;
      }
    }
    
    // If myFullName is available, exclude by name match
    if (myFullName) {
      const normalizedMyName = myFullName.toLowerCase().trim();
      const otherMember = members.find(m => {
        if (!m.user) return false;
        const memberFullName = `${m.user.prenom || ''} ${m.user.nom || ''}`.toLowerCase().trim();
        return memberFullName !== normalizedMyName;
      });
      if (otherMember?.user) {
        return otherMember.user as ProfileMinimal;
      }
    }
  }
  
  // Single member case - return what we have (edge case)
  if (members.length === 1) {
    return members[0]?.user as ProfileMinimal || null;
  }
  
  return null;
}

/**
 * Get display name for a DM counterpart
 */
export function getDmCounterpartDisplayName(
  counterpart: ProfileMinimal | null,
  fallbackName?: string
): string {
  if (!counterpart) return fallbackName || 'Conversation';
  
  const fullName = `${counterpart.prenom || ''} ${counterpart.nom || ''}`.trim();
  return fullName || counterpart.email || fallbackName || 'Conversation';
}

/**
 * Extract the other person's name from a conversation name like "Alice Dupont & Bob Martin"
 * This is a fallback when we can't determine the counterpart from members
 */
export function extractOtherNameFromConversationName(
  conversationName: string,
  myFullName: string
): string {
  if (!conversationName.includes(' & ')) return conversationName;
  if (!myFullName.trim()) return conversationName;
  
  const parts = conversationName.split(' & ');
  const otherName = parts.find(name => name.trim().toLowerCase() !== myFullName.trim().toLowerCase());
  return otherName?.trim() || conversationName;
}
