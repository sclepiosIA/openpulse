import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 's1' }, error: null }) }) }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: vi.fn() }) }),
    }),
  },
}));

import { ChatWidget } from '../ChatWidget';
import { supabase } from '@/integrations/supabase/client';

describe('ChatWidget', () => {
  it('renders chat toggle button', () => {
    const { container } = render(<ChatWidget />);
    // Initially shows the toggle button (MessageCircle icon)
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
  });

  it('accepts custom welcome message', () => {
    const { container } = render(<ChatWidget welcomeMessage="Bienvenue !" />);
    expect(container.querySelector('button')).toBeTruthy();
  });
});
