import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/hooks/search/useGlobalSearch', () => ({
  useGlobalSearch: () => ({
    results: {
      profiles: [],
      etablissements: [],
      emails: [],
      taches: [],
      events: [],
      documents: [],
      groupes: [],
      partenaires: [],
      contacts: [],
      pulseMessages: [],
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => ({
    canViewAllEtablissements: true,
    canViewAllEmails: true,
    canViewSharedEmails: false,
    canViewRHDocuments: true,
    canViewCalendar: true,
    viewScope: 'all',
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import { UniversalSearchBar } from '../UniversalSearchBar';

describe('UniversalSearchBar', () => {
  it('renders without crashing', () => {
    const { container } = render(<UniversalSearchBar />);
    expect(container).toBeTruthy();
  });
});
