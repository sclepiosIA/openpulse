import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, user: { id: 'u1' } }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { DataChatbot } from '../DataChatbot';
import { supabase } from '@/integrations/supabase/client';

describe('DataChatbot', () => {
  it('renders toggle button', () => {
    const { container } = render(<DataChatbot />);
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
  });

  it('opens chat panel when toggle clicked', () => {
    render(<DataChatbot />);
    const toggleBtn = screen.getByRole('button');
    fireEvent.click(toggleBtn);
    // After opening, welcome message should be visible
    expect(screen.getByText(/interroger/i)).toBeInTheDocument();
  });
});
