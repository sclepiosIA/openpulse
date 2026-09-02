import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/hooks/presence/useLiveChat', () => ({
  useLiveChatConversations: () => ({ data: [], isLoading: false }),
  useLiveChatConversation: () => ({ data: null, isLoading: false }),
  useLiveChatMessages: () => ({ data: [], isLoading: false }),
  useSendMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssignConversation: () => ({ mutateAsync: vi.fn() }),
  useResolveConversation: () => ({ mutateAsync: vi.fn() }),
  useEscalateConversation: () => ({ mutateAsync: vi.fn() }),
  useCreateTicketFromChat: () => ({ mutateAsync: vi.fn() }),
  useLiveChatAgents: () => ({ data: [], isLoading: false }),
  useToggleAgentAvailability: () => ({ mutateAsync: vi.fn() }),
  useLiveChatQuickReplies: () => ({ data: [], isLoading: false }),
  useLiveChatKPIs: () => ({
    activeConversations: 3,
    waitingConversations: 1,
    avgResponseTime: 120,
    resolvedToday: 5,
  }),
}));
vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', prenom: 'Test', nom: 'User' } }),
}));

import LiveChat from '../LiveChat';

describe('LiveChat page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <LiveChat />
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
