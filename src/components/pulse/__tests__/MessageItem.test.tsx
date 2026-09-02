import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', nom: 'Dupont', prenom: 'Jean' } }),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  useConversationMembers: () => ({ data: [] }),
}));

vi.mock('@/hooks/pulse/usePulseMessages', () => ({
  useEditMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePulseMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePulseMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddPulseReaction: () => ({ mutateAsync: vi.fn() }),
  useToggleReaction: () => ({ mutateAsync: vi.fn() }),
  useTogglePin: () => ({ mutateAsync: vi.fn() }),
  useThreadRepliesCount: () => ({ data: 0 }),
}));

vi.mock('./EntityPreviewHoverCard', () => ({
  EntityPreviewHoverCard: ({ children }: any) => <>{children}</>,
}));

vi.mock('./TodoInlineCard', () => ({
  TodoInlineCard: () => null,
}));

vi.mock('./PollInlineCard', () => ({
  PollInlineCard: () => null,
}));

vi.mock('./TranscriptionSummaryCard', () => ({
  TranscriptionSummaryCard: () => null,
  isTranscriptionSummary: () => false,
}));

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

import { MessageItem } from '../MessageItem';
import type { PulseMessage } from '@/types/pulse';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const message: PulseMessage = {
  id: 'm1',
  conversation_id: 'c1',
  user_id: 'u2',
  content: 'Bonjour à tous !',
  content_html: null,
  parent_message_id: null,
  message_type: 'text',
  edited_at: null,
  edited_by: null,
  edit_count: 0,
  deleted_at: null,
  deleted_by: null,
  deletion_reason: null,
  ai_processed: false,
  reaction_count: 0,
  reply_count: 0,
  mentions: [],
  created_at: '2026-03-10T10:00:00Z',
  user: {
    id: 'u2',
    nom: 'Martin',
    prenom: 'Sophie',
    avatar_url: undefined,
  },
  reactions: [],
  media: [],
};

describe('MessageItem', () => {
  it('renders message content', () => {
    render(
      <QueryClientProvider client={qc}>
        <MessageItem
          message={message}
          conversationId="c1"
          showAvatar={true}
          onOpenThread={vi.fn()}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText('Bonjour à tous !')).toBeInTheDocument();
  });

  it('renders sender name', () => {
    render(
      <QueryClientProvider client={qc}>
        <MessageItem
          message={message}
          conversationId="c1"
          showAvatar={true}
          onOpenThread={vi.fn()}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText('Sophie Martin')).toBeInTheDocument();
  });
});
