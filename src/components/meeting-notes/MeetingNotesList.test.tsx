import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MeetingNotesList } from './MeetingNotesList';

const {
  SESSIONS,
  EMPTY_SESSIONS,
  onSelect,
  onSearchChange,
  onStatusFilterChange,
} = vi.hoisted(() => ({
  SESSIONS: [
    {
      id: 's1',
      title: 'Point équipe produit',
      created_at: '2024-03-12T14:30:00.000Z',
      status: 'archived',
      decisions: [{ id: 'd1' }, { id: 'd2' }],
      next_steps: [{ id: 'n1' }],
    },
    {
      id: 's2',
      title: 'Suivi client',
      created_at: '2024-03-13T09:15:00.000Z',
      status: 'processing',
      decisions: [],
      next_steps: [{ id: 'n2' }, { id: 'n3' }],
    },
    {
      id: 's3',
      title: 'Incident support',
      created_at: '2024-03-14T08:00:00.000Z',
      status: 'unknown_status',
      decisions: [],
      next_steps: [],
    },
  ],
  EMPTY_SESSIONS: [],
  onSelect: vi.fn(),
  onSearchChange: vi.fn(),
  onStatusFilterChange: vi.fn(),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    FileAudio: Icon,
    Clock: Icon,
    CheckCircle: Icon,
    Loader2: Icon,
    Search: Icon,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <button type="button" data-testid="card" className={className} onClick={onClick}>
      {children}
    </button>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="select-root" data-value={value}>
      <select
        data-testid="status-select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="all">Tous</option>
        <option value="archived">Terminés</option>
        <option value="processing">En cours</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="select-trigger" className={className}>
      {children}
    </div>
  ),
  SelectValue: () => <span data-testid="select-value" />,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
}));

describe('MeetingNotesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche un état de chargement avec spinner et sans liste', () => {
    render(
      <MeetingNotesList
        sessions={EMPTY_SESSIONS}
        isLoading
        selectedId={undefined}
        onSelect={onSelect}
        searchQuery=""
        onSearchChange={onSearchChange}
        statusFilter="all"
        onStatusFilterChange={onStatusFilterChange}
      />
    );

    expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
    expect(screen.getByTestId('status-select')).toHaveValue('all');
    expect(screen.queryByText('Aucune note de réunion')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card')).not.toBeInTheDocument();

    const icons = screen.getAllByTestId('icon');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('affiche l état vide quand aucune session n est disponible', () => {
    render(
      <MeetingNotesList
        sessions={EMPTY_SESSIONS}
        isLoading={false}
        selectedId={undefined}
        onSelect={onSelect}
        searchQuery=""
        onSearchChange={onSearchChange}
        statusFilter="all"
        onStatusFilterChange={onStatusFilterChange}
      />
    );

    expect(screen.getByText('Aucune note de réunion')).toBeInTheDocument();
    expect(screen.getByText('Importez un fichier audio pour commencer')).toBeInTheDocument();
    expect(screen.queryByTestId('card')).not.toBeInTheDocument();
  });

  it('affiche les sessions avec les informations métier réelles et le fallback de statut', () => {
    render(
      <MeetingNotesList
        sessions={SESSIONS}
        isLoading={false}
        selectedId="s2"
        onSelect={onSelect}
        searchQuery="client"
        onSearchChange={onSearchChange}
        statusFilter="processing"
        onStatusFilterChange={onStatusFilterChange}
      />
    );

    expect(screen.getByDisplayValue('client')).toBeInTheDocument();
    expect(screen.getByTestId('status-select')).toHaveValue('processing');

    expect(screen.getByText('Point équipe produit')).toBeInTheDocument();
    expect(screen.getByText('Suivi client')).toBeInTheDocument();
    expect(screen.getByText('Incident support')).toBeInTheDocument();

    expect(screen.getByText('2 décisions')).toBeInTheDocument();
    expect(screen.getByText('1 action')).toBeInTheDocument();
    expect(screen.getByText('2 actions')).toBeInTheDocument();

    expect(screen.getByText('Terminé')).toBeInTheDocument();
    expect(screen.getByText('En traitement')).toBeInTheDocument();
    expect(screen.getByText('Erreur')).toBeInTheDocument();

    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(3);
    expect(cards[1].className).toContain('ring-2');
    expect(cards[1].className).toContain('bg-primary/5');
    expect(cards[0].className).not.toContain('ring-2');
  });

  it('déclenche les callbacks de recherche, filtre et sélection', () => {
    render(
      <MeetingNotesList
        sessions={SESSIONS}
        isLoading={false}
        selectedId={undefined}
        onSelect={onSelect}
        searchQuery=""
        onSearchChange={onSearchChange}
        statusFilter="all"
        onStatusFilterChange={onStatusFilterChange}
      />
    );

    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'produit' },
    });
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('produit');

    fireEvent.change(screen.getByTestId('status-select'), {
      target: { value: 'archived' },
    });
    expect(onStatusFilterChange).toHaveBeenCalledTimes(1);
    expect(onStatusFilterChange).toHaveBeenCalledWith('archived');

    fireEvent.click(screen.getByText('Suivi client'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(SESSIONS[1]);
  });

  it('n affiche pas les compteurs de décisions ou actions quand ils sont absents', () => {
    render(
      <MeetingNotesList
        sessions={[SESSIONS[2]]}
        isLoading={false}
        selectedId={undefined}
        onSelect={onSelect}
        searchQuery=""
        onSearchChange={onSearchChange}
        statusFilter="all"
        onStatusFilterChange={onStatusFilterChange}
      />
    );

    expect(screen.getByText('Incident support')).toBeInTheDocument();
    expect(screen.queryByText(/décision/)).not.toBeInTheDocument();
    expect(screen.queryByText(/action/)).not.toBeInTheDocument();
    expect(screen.getByText('Erreur')).toBeInTheDocument();
  });
});