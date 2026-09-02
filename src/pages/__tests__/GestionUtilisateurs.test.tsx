import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/lib/supabaseBrowser', () => mockSupabaseModule());
vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
}));
vi.mock('@/lib/supabase-helpers', () => ({
  queryViewWithFilter: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useProfilesWithRoles: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/profile/useProfiles', () => ({
  useCreateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteProfile: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/auth/useAdminResetPassword', () => ({
  useAdminResetPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  generateSecurePassword: () => 'SecurePass123!',
}));
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'error',
}));
vi.mock('@/components/security/AdminGuard', () => ({
  AdminGuard: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/components/auth/PasswordStrengthIndicator', () => ({
  PasswordStrengthIndicator: () => null,
}));

import GestionUtilisateurs from '../GestionUtilisateurs';

describe('GestionUtilisateurs page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <GestionUtilisateurs />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
