// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivityDetailSheet } from './ActivityDetailSheet';

const { toastSuccess, onOpenChange, onTogglePin, ITEM } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  onOpenChange: vi.fn(),
  onTogglePin: vi.fn(),
  ITEM: {
    id: 'act-1',
    icon: 'Bell',
    color: 'blue',
    type: 'note',
    title: 'Mise à jour du dossier',
    occurred_at: '2024-01-15T14:30:00.000Z',
    actor_name: 'Jean Dupont',
    description: 'Description détaillée\naffichée sur deux lignes',
    etablissement_id: 'etab-1',
    etablissement_nom: 'Clinique du Lac',
    metadata: {
      statut: 'validé',
      count: 3,
      vide: null,
    },
    link: '/patients/p-1',
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: vi.fn(),
  },
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => (
    <div data-testid="sheet" data-open={String(open)}>
      <button type="button" data-testid="sheet-close" onClick={() => onOpenChange(false)}>
        close
      </button>
      {children}
    </div>
  ),
  SheetContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="sheet-content" className={className}>
      {children}
    </div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-header">{children}</div>,
  SheetTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h1 className={className}>{children}</h1>,
  SheetDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p className={className}>{children}</p>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild,
    onClick,
    variant,
    size,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    onClick?: () => void;
    variant?: string;
    size?: string;
  }) => {
    if (asChild) {
      return (
        <div data-testid="button-as-child" data-variant={variant} data-size={size}>
          {children}
        </div>
      );
    }
    return (
      <button type="button" data-variant={variant} data-size={size} onClick={onClick}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: ({ className }: { className?: string }) => <hr data-testid="separator" className={className} />,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="avatar-fallback" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/types/activity', () => ({
  ACTIVITY_COLOR_CLASSES: {
    blue: 'bg-blue text-white',
    gray: 'bg-gray text-black',
  },
  ACTIVITY_TYPE_LABELS: {
    note: 'Note',
    alert: 'Alerte',
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | undefined | null | false>) => values.filter(Boolean).join(' '),
}));

describe('ActivityDetailSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost' },
      writable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
    });
  });

  it('returns null when item is null', () => {
    const { container } = render(
      <MemoryRouter>
        <ActivityDetailSheet
          item={null}
          open={true}
          onOpenChange={onOpenChange}
          pinned={false}
          onTogglePin={onTogglePin}
        />
      </MemoryRouter>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders business data, links and metadata correctly', () => {
    render(
      <MemoryRouter>
        <ActivityDetailSheet
          item={ITEM}
          open={true}
          onOpenChange={onOpenChange}
          pinned={false}
          onTogglePin={onTogglePin}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('sheet')).toHaveAttribute('data-open', 'true');
    expect(screen.getByText('Mise à jour du dossier')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Auteur')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Description détaillée affichée sur deux lignes')).toBeInTheDocument();
    expect(screen.getByText('Établissement')).toBeInTheDocument();
    expect(screen.getByText('🏥 Clinique du Lac')).toBeInTheDocument();
    expect(screen.getByText('Détails')).toBeInTheDocument();
    expect(screen.getByText('statut')).toBeInTheDocument();
    expect(screen.getByText('validé')).toBeInTheDocument();
    expect(screen.getByText('count')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('vide')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('JD');

    const etablisementLink = screen.getByRole('link', { name: /clinique du lac/i });
    expect(etablisementLink).toHaveAttribute('href', '/etablissements/etab-1');

    const openLink = screen.getByRole('link', { name: /ouvrir/i });
    expect(openLink).toHaveAttribute('href', '/patients/p-1');

    expect(screen.getByText(/15 janvier 2024/i)).toBeInTheDocument();
  });

  it('calls onTogglePin with item id and current pinned state', () => {
    render(
      <MemoryRouter>
        <ActivityDetailSheet
          item={ITEM}
          open={true}
          onOpenChange={onOpenChange}
          pinned={true}
          onTogglePin={onTogglePin}
        />
      </MemoryRouter>,
    );

    const pinButton = screen.getByRole('button', { name: /désépingler/i });
    fireEvent.click(pinButton);

    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(onTogglePin).toHaveBeenCalledWith('act-1', true);
  });

  it('copies the generated focus link and shows a success toast', async () => {
    render(
      <MemoryRouter>
        <ActivityDetailSheet
          item={ITEM}
          open={true}
          onOpenChange={onOpenChange}
          pinned={false}
          onTogglePin={onTogglePin}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /copier le lien/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://localhost/activite?focus=act-1',
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith('Lien copié');
  });

  it('calls onOpenChange when sheet requests close', () => {
    render(
      <MemoryRouter>
        <ActivityDetailSheet
          item={ITEM}
          open={true}
          onOpenChange={onOpenChange}
          pinned={false}
          onTogglePin={onTogglePin}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('sheet-close'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('falls back to default values when optional fields are missing', () => {
    const minimalItem = {
      ...ITEM,
      icon: 'IconInconnue',
      color: 'unknown',
      actor_name: '',
      description: '',
      etablissement_id: null,
      etablissement_nom: '',
      metadata: {},
      link: '',
    };

    render(
      <MemoryRouter>
        <ActivityDetailSheet
          item={minimalItem}
          open={true}
          onOpenChange={onOpenChange}
          pinned={false}
          onTogglePin={onTogglePin}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('?');
    expect(screen.queryByText('Établissement')).not.toBeInTheDocument();
    expect(screen.queryByText('Détails')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ouvrir/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /épingler/i })).toBeInTheDocument();
  });
});