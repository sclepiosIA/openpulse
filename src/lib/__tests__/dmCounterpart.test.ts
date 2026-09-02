import { describe, it, expect } from 'vitest';
import {
  isDMConversation, getDmCounterpart, getDmCounterpartDisplayName,
  extractOtherNameFromConversationName,
} from '../pulse/dmCounterpart';

const makeMember = (userId: string, user: Record<string, unknown> = {}) => ({
  user_id: userId,
  user: { id: userId, nom: 'Dupont', prenom: 'Alice', email: 'alice@test.com', ...user },
});

const makeConversation = (isDm: boolean, members: any[] = []) => ({
  id: 'conv-1',
  name: 'Alice & Bob',
  metadata: isDm ? { type: 'dm' } : null,
  members,
} as any);

describe('dmCounterpart', () => {
  describe('isDMConversation', () => {
    it('returns true for DM', () => {
      expect(isDMConversation(makeConversation(true))).toBe(true);
    });
    it('returns false for group', () => {
      expect(isDMConversation(makeConversation(false))).toBe(false);
    });
  });

  describe('getDmCounterpart', () => {
    it('returns other member by profile ID', () => {
      const members = [
        makeMember('me', { nom: 'Me', prenom: 'Test', email: 'me@test.com' }),
        makeMember('other', { nom: 'Other', prenom: 'User', email: 'other@test.com' }),
      ];
      const conv = makeConversation(true, members);
      const result = getDmCounterpart(conv, 'me');
      expect(result?.id).toBe('other');
    });

    it('returns null for non-DM', () => {
      expect(getDmCounterpart(makeConversation(false, []), 'me')).toBeNull();
    });

    it('falls back to email matching', () => {
      const members = [
        makeMember('u1', { email: 'me@test.com' }),
        makeMember('u2', { email: 'other@test.com' }),
      ];
      const conv = makeConversation(true, members);
      const result = getDmCounterpart(conv, undefined, undefined, 'me@test.com');
      expect(result?.id).toBe('u2');
    });

    it('returns single member for 1-member DM', () => {
      const members = [makeMember('u1')];
      const conv = makeConversation(true, members);
      const result = getDmCounterpart(conv, 'non-existing');
      expect(result?.id).toBe('u1');
    });
  });

  describe('getDmCounterpartDisplayName', () => {
    it('returns full name', () => {
      expect(getDmCounterpartDisplayName({ id: '1', prenom: 'Alice', nom: 'Dupont' })).toBe('Alice Dupont');
    });
    it('returns fallback for null', () => {
      expect(getDmCounterpartDisplayName(null, 'Fallback')).toBe('Fallback');
    });
    it('returns Conversation as default', () => {
      expect(getDmCounterpartDisplayName(null)).toBe('Conversation');
    });
  });

  describe('extractOtherNameFromConversationName', () => {
    it('extracts other name', () => {
      expect(extractOtherNameFromConversationName('Alice Dupont & Bob Martin', 'Alice Dupont')).toBe('Bob Martin');
    });
    it('returns original if no &', () => {
      expect(extractOtherNameFromConversationName('Group Chat', 'Alice')).toBe('Group Chat');
    });
    it('returns original if empty myName', () => {
      expect(extractOtherNameFromConversationName('Alice & Bob', '')).toBe('Alice & Bob');
    });
  });
});
