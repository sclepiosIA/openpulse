import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'user-1', prenom: 'Test', nom: 'User' } }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}));

import { pulsePollKeys } from '../pulse/usePulsePolls';
import { supabase } from '@/integrations/supabase/client';

describe('usePulsePolls', () => {
  it('pulsePollKeys generates correct keys', () => {
    expect(pulsePollKeys.all).toEqual(['pulse-polls']);
    expect(pulsePollKeys.byId('poll-1')).toEqual(['pulse-polls', 'detail', 'poll-1']);
    expect(pulsePollKeys.byConversation('conv-1')).toEqual(['pulse-polls', 'conversation', 'conv-1']);
  });
});
