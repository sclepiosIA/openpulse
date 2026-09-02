import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', nom: 'Dupont', prenom: 'Jean' } }),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/lib/pulse/dmCounterpart', () => ({
  isDMConversation: () => false,
  getDmCounterpart: () => null,
  getDmCounterpartDisplayName: () => '',
  extractOtherNameFromConversationName: () => '',
}));

vi.mock('./VirtualizedConversationList', () => ({
  VirtualizedConversationList: () => null,
}));

import { ConversationList } from '../ConversationList';
import type { PulseConversation } from '@/types/pulse';

const conversations: PulseConversation[] = [
  {
    id: 'c1',
    name: 'Équipe Dev',
    etablissement_id: null,
    description: null,
    visibility: 'public',
    created_by: 'u1',
    is_archived: false,
    archived_at: null,
    archived_by: null,
    metadata: {},
    created_at: '2026-01-01',
    updated_at: '2026-03-10',
    unread_count: 2,
  },
];

describe('ConversationList', () => {
  it('renders conversation name', () => {
    render(
      <ConversationList
        conversations={conversations}
        selectedId={null}
        onSelect={vi.fn()}
        onlineUsers={[]}
      />
    );
    expect(screen.getByText('Équipe Dev')).toBeInTheDocument();
  });

  it('renders unread badge', () => {
    render(
      <ConversationList
        conversations={conversations}
        selectedId={null}
        onSelect={vi.fn()}
        onlineUsers={[]}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
