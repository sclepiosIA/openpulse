import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const chainable: any = new Proxy({}, {
  get: () => (..._args: any[]) => chainable,
});
// Override terminal methods
chainable.maybeSingle = () => Promise.resolve({ data: null, error: null });
chainable.single = () => Promise.resolve({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => chainable,
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: vi.fn() }) }),
    }),
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', prenom: 'Jean', nom: 'Dupont' } }),
}));

vi.mock('@/hooks/calendar/useCalendarPresence', () => ({
  useCalendarPresence: () => ({ calendarStatus: null }),
}));

vi.mock('@/types/pulse', () => ({
  PRESENCE_STATUS_CONFIG: {
    active: { label: 'Actif', color: 'green', icon: '🟢' },
    away: { label: 'Absent', color: 'yellow', icon: '🟡' },
    busy: { label: 'Occupé', color: 'red', icon: '🔴' },
    dnd: { label: 'Ne pas déranger', color: 'red', icon: '⛔' },
  },
}));

import { StatusSelector } from '../StatusSelector';
import { supabase } from '@/integrations/supabase/client';

describe('StatusSelector', () => {
  it('renders dropdown trigger', () => {
    render(<StatusSelector />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
