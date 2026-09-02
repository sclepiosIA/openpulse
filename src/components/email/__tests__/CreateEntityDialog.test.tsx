import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'Error',
}));

vi.mock('@/hooks/search/useCreateEntityMutations', () => ({
  useCreateEntityMutations: () => ({
    createEntity: vi.fn(),
    isCreating: false,
  }),
}));

vi.mock('@/components/ui/LogoUploadField', () => ({
  LogoUploadField: () => <div data-testid="logo-upload" />,
}));

import { CreateEntityDialog } from '../CreateEntityDialog';

describe('CreateEntityDialog', () => {
  it('renders etablissement dialog', () => {
    render(
      <CreateEntityDialog open={true} onOpenChange={vi.fn()} type="etablissement" onCreated={vi.fn()} />
    );
    expect(screen.getByText(/Créer un établissement/i)).toBeInTheDocument();
  });

  it('renders partenaire dialog', () => {
    render(
      <CreateEntityDialog open={true} onOpenChange={vi.fn()} type="partenaire" onCreated={vi.fn()} />
    );
    expect(screen.getByText(/Créer un partenaire/i)).toBeInTheDocument();
  });

  it('renders groupe dialog', () => {
    render(
      <CreateEntityDialog open={true} onOpenChange={vi.fn()} type="groupe" onCreated={vi.fn()} />
    );
    expect(screen.getByText(/Créer un groupe/i)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <CreateEntityDialog open={false} onOpenChange={vi.fn()} type="etablissement" onCreated={vi.fn()} />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
