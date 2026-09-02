import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/profile/useProfiles', () => ({
  useUpdateProfile: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

import { EditEmployeeDialog } from '../EditEmployeeDialog';

const profile = {
  id: 'p1',
  nom: 'Dupont',
  prenom: 'Jean',
  email: 'jean@test.com',
  fonction: 'Développeur',
  role: 'csm' as const,
  date_embauche: '2024-01-01',
  type_contrat: 'cdi' as const,
  actif: true,
  avatar_url: null,
  telephone: null,
} as any;

describe('EditEmployeeDialog', () => {
  it('renders dialog title when open', () => {
    render(<EditEmployeeDialog open={true} onOpenChange={vi.fn()} profile={profile} />);
    expect(screen.getByText(/Modifier l'employé/i)).toBeInTheDocument();
  });

  it('pre-fills form with profile data', () => {
    render(<EditEmployeeDialog open={true} onOpenChange={vi.fn()} profile={profile} />);
    expect(screen.getByDisplayValue('Dupont')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jean')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jean@test.com')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<EditEmployeeDialog open={false} onOpenChange={vi.fn()} profile={profile} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
