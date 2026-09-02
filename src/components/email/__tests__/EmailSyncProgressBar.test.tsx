import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const chainable: any = new Proxy({}, {
  get: () => (..._args: any[]) => chainable,
});
chainable.maybeSingle = () => Promise.resolve({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => chainable },
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn() },
}));

vi.mock('@/hooks/ui/useVisibilityAwareInterval', () => ({
  useVisibilityAwareInterval: vi.fn(),
}));

import { EmailSyncProgressBar } from '../EmailSyncProgressBar';
import { supabase } from '@/integrations/supabase/client';

describe('EmailSyncProgressBar', () => {
  it('renders without crashing', () => {
    const { container } = render(<EmailSyncProgressBar />);
    expect(container).toBeTruthy();
  });

  it('renders nothing when no sync in progress', () => {
    const { container } = render(<EmailSyncProgressBar />);
    // With null data, should render nothing visible
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});
