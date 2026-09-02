import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { EmailAccountSelector } from '../EmailAccountSelector';

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'p1' }, isLoading: false }),
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: () => ({
    select: () => ({
      eq: () => ({
        or: () => ({
          order: () => Promise.resolve({
            data: [
              { id: 'a1', email_address: 'test@marque.com', is_active: true, profile_id: 'p1', is_shared: false },
              { id: 'a2', email_address: 'support@marque.com', is_active: true, profile_id: 'p1', is_shared: true },
            ],
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe('EmailAccountSelector', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(
      <EmailAccountSelector value="a1" onChange={vi.fn()} />
    );
    expect(container).toBeInTheDocument();
  });
});
