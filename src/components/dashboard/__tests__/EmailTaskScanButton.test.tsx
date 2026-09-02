import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailTaskScanButton } from '../EmailTaskScanButton';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn(() => Promise.resolve({ data: { results: [] }, error: null })) },
  },
}));

describe('EmailTaskScanButton', () => {
  it('renders card title', () => {
    render(<EmailTaskScanButton />);
    expect(screen.getByText(/Scanner les emails/i)).toBeInTheDocument();
  });

  it('renders period selector', () => {
    render(<EmailTaskScanButton />);
    expect(screen.getByText('24h')).toBeInTheDocument();
    expect(screen.getByText('48h')).toBeInTheDocument();
    expect(screen.getByText('72h')).toBeInTheDocument();
  });

  it('renders extract button', () => {
    render(<EmailTaskScanButton />);
    expect(screen.getByText(/Extraire les tâches/i)).toBeInTheDocument();
  });
});
