import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));
vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', nom: 'Test', prenom: 'User' } }),
}));
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

import { TranscriptionProvider, useTranscription } from '../TranscriptionContext';
import { supabase } from '@/integrations/supabase/client';

function TestConsumer() {
  const { isSessionActive, isRecording, segments } = useTranscription();
  return (
    <div>
      <span data-testid="active">{String(isSessionActive)}</span>
      <span data-testid="recording">{String(isRecording)}</span>
      <span data-testid="segments">{segments.length}</span>
    </div>
  );
}

describe('TranscriptionContext', () => {
  it('provides initial state', () => {
    render(
      <TranscriptionProvider><TestConsumer /></TranscriptionProvider>
    );
    expect(screen.getByTestId('active').textContent).toBe('false');
    expect(screen.getByTestId('recording').textContent).toBe('false');
    expect(screen.getByTestId('segments').textContent).toBe('0');
  });

  // TranscriptionContext doesn't throw outside provider, it returns undefined
});
