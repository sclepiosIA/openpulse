import { describe, it, expect } from 'vitest';
import { isDMConversation, getDmCounterpart, getDmCounterpartDisplayName, extractOtherNameFromConversationName } from './dmCounterpart';

interface ProfileMinimal {
  id: string;
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface PulseConversationMember {
  user_id: string;
  user: ProfileMinimal | null;
}

interface PulseConversation {
  id: string;
  name?: string | null;
  metadata: Record<string, unknown> | null;
  members: PulseConversationMember[];
}

describe('isDMConversation', () => {
  it('returns true when metadata.type is dm', () => {
    const conversation: PulseConversation = {
      id: 'c1',
      name: 'test',
      metadata: { type: 'dm' },
      members: []
    };
    expect(isDMConversation(conversation)).toBe(true);
  });

  it('returns false when metadata.type is not dm', () => {
    const conversation: PulseConversation = {
      id: 'c2',
      name: 'test',
      metadata: { type: 'group' },
      members: []
    };
    expect(isDMConversation(conversation)).toBe(false);
  });

  it('returns false when metadata is null', () => {
    const conversation: PulseConversation = {
      id: 'c3',
      name: 'test',
      metadata: null,
      members: []
    };
    expect(isDMConversation(conversation)).toBe(false);
  });

  it('returns false when metadata has no type', () => {
    const conversation: PulseConversation = {
      id: 'c4',
      name: 'test',
      metadata: {},
      members: []
    };
    expect(isDMConversation(conversation)).toBe(false);
  });
});

describe('getDmCounterpart', () => {
  const baseMembers: PulseConversationMember[] = [
    {
      user_id: 'p1',
      user: {
        id: 'p1',
        prenom: 'Alice',
        nom: 'Durand',
        email: 'alice@example.com',
        avatar_url: null
      }
    },
    {
      user_id: 'p2',
      user: {
        id: 'p2',
        prenom: 'Bob',
        nom: 'Martin',
        email: 'bob@example.com',
        avatar_url: null
      }
    }
  ];

  const dmConversation: PulseConversation = {
    id: 'c1',
    name: 'Alice Durand & Bob Martin',
    metadata: { type: 'dm', participants: ['p1', 'p2'] },
    members: baseMembers
  };

  it('returns null when conversation is not a DM', () => {
    const conversation: PulseConversation = {
      ...dmConversation,
      metadata: { type: 'group' }
    };
    const result = getDmCounterpart(conversation, 'p1');
    expect(result).toBeNull();
  });

  it('returns null when members list is empty', () => {
    const conversation: PulseConversation = {
      ...dmConversation,
      members: []
    };
    const result = getDmCounterpart(conversation, 'p1');
    expect(result).toBeNull();
  });

  it('returns other member using myProfileId primary path', () => {
    const result = getDmCounterpart(dmConversation, 'p1', undefined, undefined);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('p2');
    expect(result?.email).toBe('bob@example.com');
  });

  it('returns other member using email fallback when no profileId', () => {
    const result = getDmCounterpart(dmConversation, null, null, 'alice@example.com');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('p2');
    expect(result?.email).toBe('bob@example.com');
  });

  it('matches email case-insensitively and with trimming', () => {
    const result = getDmCounterpart(dmConversation, null, null, '  ALICE@EXAMPLE.COM ');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('p2');
  });

  it('returns other member using full name fallback when no profileId or email', () => {
    const result = getDmCounterpart(dmConversation, null, 'Alice Durand', null);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('p2');
    expect(result?.prenom).toBe('Bob');
  });

  it('matches full name case-insensitively and with trimming', () => {
    const result = getDmCounterpart(dmConversation, undefined, '  alice durand ', undefined);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('p2');
  });

  it('uses metadata.participants fallback when profileId provided but members not matched earlier', () => {
    const conversation: PulseConversation = {
      ...dmConversation,
      members: [
        {
          user_id: 'p1',
          user: {
            id: 'p1',
            prenom: 'Alice',
            nom: 'Durand',
            email: 'alice@example.com',
            avatar_url: null
          }
        },
        {
          user_id: 'p2',
          user: {
            id: 'p2',
            prenom: 'Bob',
            nom: 'Martin',
            email: 'bob@example.com',
            avatar_url: null
          }
        }
      ],
      metadata: { type: 'dm', participants: ['p1', 'p2'] }
    };
    const result = getDmCounterpart(conversation, 'p1', undefined, undefined);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('p2');
  });

  it('uses conversation name "&" fallback to infer other member when full name given', () => {
    const conversation: PulseConversation = {
      ...dmConversation,
      members: [
        {
          user_id: 'p1',
          user: {
            id: 'p1',
            prenom: 'Alice',
            nom: 'Durand',
            email: null,
            avatar_url: null
          }
        },
        {
          user_id: 'p2',
          user: {
            id: 'p2',
            prenom: 'Bob',
            nom: 'Martin',
            email: null,
            avatar_url: null
          }
        }
      ]
    };
    const result = getDmCounterpart(conversation, undefined, 'Alice Durand', undefined);
    expect(result).not.toBeNull();
    expect(result?.prenom).toBe('Bob');
    expect(result?.nom).toBe('Martin');
  });

  it('returns non-self member as primary resolution when two members and myProfileId known', () => {
    const conversation: PulseConversation = {
      ...dmConversation,
      metadata: { type: 'dm' }
    };
    const result = getDmCounterpart(conversation, 'p1', undefined, undefined);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('p2');
  });

  it('returns non-self member as last resort when two members and myFullName known but not matched earlier', () => {
    const conversation: PulseConversation = {
      ...dmConversation,
      metadata: { type: 'dm' }
    };
    const result = getDmCounterpart(conversation, undefined, 'Alice Durand', undefined);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('p2');
  });

  it('returns single member user when only one member present and still DM', () => {
    const singleMemberConversation: PulseConversation = {
      id: 'c-single',
      name: 'Only One',
      metadata: { type: 'dm' },
      members: [
        {
          user_id: 'p1',
          user: {
            id: 'p1',
            prenom: 'Solo',
            nom: 'User',
            email: 'solo@example.com',
            avatar_url: null
          }
        }
      ]
    };
    const result = getDmCounterpart(singleMemberConversation, undefined, undefined, undefined);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('p1');
  });

  it('falls back to metadata.participants only when myProfileId is present and included', () => {
    const conversation: PulseConversation = {
      ...dmConversation,
      metadata: { type: 'dm', participants: ['p3', 'p4'] }
    };
    const result = getDmCounterpart(conversation, 'p1', undefined, undefined);
    // myProfileId is not in participants; function skips that fallback and uses primary path
    expect(result).not.toBeNull();
    expect(result?.id).toBe('p2');
  });

  it('returns null when members have no user data and no other fallback works', () => {
    const conversation: PulseConversation = {
      id: 'c-empty-users',
      name: 'Unknown & Unknown',
      metadata: { type: 'dm' },
      members: [
        { user_id: 'p1', user: null },
        { user_id: 'p2', user: null }
      ]
    };
    const result = getDmCounterpart(conversation, 'p1', 'Someone Else', 'some@example.com');
    expect(result).toBeNull();
  });
});

describe('getDmCounterpartDisplayName', () => {
  it('returns full name when available', () => {
    const counterpart: ProfileMinimal = {
      id: 'p2',
      prenom: 'Bob',
      nom: 'Martin',
      email: 'bob@example.com',
      avatar_url: null
    };
    const name = getDmCounterpartDisplayName(counterpart, 'Fallback');
    expect(name).toBe('Bob Martin');
  });

  it('uses email when no first/last name but email present', () => {
    const counterpart: ProfileMinimal = {
      id: 'p2',
      prenom: null,
      nom: null,
      email: 'bob@example.com',
      avatar_url: null
    };
    const name = getDmCounterpartDisplayName(counterpart, 'Fallback');
    expect(name).toBe('bob@example.com');
  });

  it('uses fallback name when no name or email', () => {
    const counterpart: ProfileMinimal = {
      id: 'p2',
      prenom: null,
      nom: null,
      email: null,
      avatar_url: null
    };
    const name = getDmCounterpartDisplayName(counterpart, 'Fallback Name');
    expect(name).toBe('Fallback Name');
  });

  it('returns default "Conversation" when no counterpart and no fallback', () => {
    const name = getDmCounterpartDisplayName(null);
    expect(name).toBe('Conversation');
  });

  it('returns fallback when counterpart is null but fallback provided', () => {
    const name = getDmCounterpartDisplayName(null, 'Chat with someone');
    expect(name).toBe('Chat with someone');
  });
});

describe('extractOtherNameFromConversationName', () => {
  it('returns other name from "A & B" when my name is A', () => {
    const result = extractOtherNameFromConversationName('Alice Durand & Bob Martin', 'Alice Durand');
    expect(result).toBe('Bob Martin');
  });

  it('returns other name from "A & B" when my name is B', () => {
    const result = extractOtherNameFromConversationName('Alice Durand & Bob Martin', 'Bob Martin');
    expect(result).toBe('Alice Durand');
  });

  it('handles extra spaces and case-insensitive matching', () => {
    const result = extractOtherNameFromConversationName('Alice Durand & Bob Martin', '  alice durand ');
    expect(result).toBe('Bob Martin');
  });

  it('returns original name when no "&" present', () => {
    const result = extractOtherNameFromConversationName('General Chat', 'Alice');
    expect(result).toBe('General Chat');
  });

  it('returns original name when myFullName is empty', () => {
    const result = extractOtherNameFromConversationName('Alice Durand & Bob Martin', '   ');
    expect(result).toBe('Alice Durand & Bob Martin');
  });

  it('returns original name when no different part found', () => {
    const result = extractOtherNameFromConversationName('Alice & Alice', 'Alice');
    expect(result).toBe('Alice & Alice');
  });
});