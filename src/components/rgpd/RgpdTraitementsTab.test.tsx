/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RgpdTraitementsTab } from './RgpdTraitementsTab';

const {
  TRAITEMENTS,
  BASE_LEGALE_LABELS,
  mutateAsyncMock,
} = vi.hoisted(() => ({
  TRAITEMENTS: [
    {
      id: 't1',
      nom: 'Gestion des clients',
      base_legale: 'contrat',
      donnees_sensibles: false,
      dpia_requis: false,
      dpia_realise: false,
      est_actif: true,
    },
    {
      id: 't2',
      nom: 'Suivi santé salariés',
      base_legale: 'obligation_legale',
      donnees_sensibles: true,
      dpia_requis: true,
      dpia_realise: false,
      est_actif: false,
    },
    {
      id: 't3',
      nom: 'Analyse marketing',
      base_legale: 'consentement',
      donnees_sensibles: false,
      dpia_requis: true,
      dpia_realise: true,
      est_actif: true,
    },
  ],
  BASE_LEGALE_LABELS: {
    consentement: 'Consentement',
    contrat: 'Contrat',
    obligation_legale: 'Obligation légale',
    interet_vital: 'Intérêt vital',
    mission_interet_public: 'Mission d’intérêt public',
    interets_legitimes: 'Intérêts légitimes',
  },
  mutateAsyncMock: vi.fn(),
}));

vi.mock('@/types/rgpd', () => ({
  BASE_LEGALE_LABELS,
}));

vi.mock('@/hooks/auth/useRgpd', () => ({
  useCreateRgpdTraitement: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} onChange={onChange} placeholder={placeholder} className={className} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea value={value} onChange={onChange} placeholder={placeholder} />
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
        aria-label="Base légale"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {Object.entries(BASE_LEGALE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
}));

vi.mock('@/components/ui/dialog', () => {
  const ReactLocal = React;
  return {
    Dialog: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: React.ReactNode;
    }) => <div data-open={String(open)} data-testid="dialog-root">{ReactLocal.Children.map(children, (child) => {
      if (!ReactLocal.isValidElement(child)) return child;
      return ReactLocal.cloneElement(child as React.ReactElement<{ open?: boolean; onOpenChange?: (open: boolean) => void }>, {
        open,
        onOpenChange,
      });
    })}</div>,
    DialogTrigger: ({
      children,
      onOpenChange,
    }: {
      children: React.ReactElement<{ onClick?: () => void }>;
      asChild?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) =>
      ReactLocal.cloneElement(children, {
        onClick: () => onOpenChange?.(true),
      }),
    DialogContent: ({
      children,
      open,
    }: {
      children: React.ReactNode;
      open?: boolean;
      className?: string;
    }) => (open ? <div>{children}</div> : null),
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  };
});

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({
    children,
    colSpan,
    className,
  }: {
    children: React.ReactNode;
    colSpan?: number;
    className?: string;
  }) => (
    <td colSpan={colSpan} className={className}>
      {children}
    </td>
  ),
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
}));

vi.mock('lucide-react', () => ({
  Plus: () => <svg data-testid="plus-icon" />,
  Search: () => <svg data-testid="search-icon" />,
}));

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('RgpdTraitementsTab', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ data: { id: 'created-1' }, error: null });
  });

  it('affiche les traitements avec leurs libellés métier et statuts RGPD', () => {
    renderWithClient(<RgpdTraitementsTab traitements={TRAITEMENTS} />);

    expect(screen.getByText('Gestion des clients')).toBeInTheDocument();
    expect(screen.getByText('Suivi santé salariés')).toBeInTheDocument();
    expect(screen.getByText('Analyse marketing')).toBeInTheDocument();

    expect(screen.getByText('Contrat')).toBeInTheDocument();
    expect(screen.getByText('Obligation légale')).toBeInTheDocument();
    expect(screen.getByText('Consentement')).toBeInTheDocument();

    expect(screen.getAllByText('Oui')).toHaveLength(1);
    expect(screen.getAllByText('Non')).toHaveLength(2);

    expect(screen.getByText('Requise')).toBeInTheDocument();
    expect(screen.getByText('Réalisée')).toBeInTheDocument();
    expect(screen.getByText('Non requise')).toBeInTheDocument();

    expect(screen.getAllByText('Actif')).toHaveLength(2);
    expect(screen.getByText('Inactif')).toBeInTheDocument();
  });

  it('filtre la liste selon le terme recherché', () => {
    renderWithClient(<RgpdTraitementsTab traitements={TRAITEMENTS} />);

    fireEvent.change(screen.getByPlaceholderText('Rechercher un traitement...'), {
      target: { value: 'marketing' },
    });

    expect(screen.getByText('Analyse marketing')).toBeInTheDocument();
    expect(screen.queryByText('Gestion des clients')).not.toBeInTheDocument();
    expect(screen.queryByText('Suivi santé salariés')).not.toBeInTheDocument();
  });

  it('affiche un état vide quand aucun traitement nest fourni', () => {
    renderWithClient(<RgpdTraitementsTab traitements={[]} />);

    expect(screen.getByText('Aucun traitement enregistré')).toBeInTheDocument();
  });

  it('ouvre le dialogue, permet de saisir un traitement et appelle la mutation avec les valeurs réelles', async () => {
    renderWithClient(<RgpdTraitementsTab traitements={TRAITEMENTS} />);

    fireEvent.click(screen.getByRole('button', { name: /nouveau traitement/i }));

    expect(screen.getByText('Nouveau traitement de données')).toBeInTheDocument();
    expect(screen.getByText(/article 30 rgpd/i)).toBeInTheDocument();

    const createButton = screen.getByRole('button', { name: /créer le traitement/i });
    expect(createButton).toBeDisabled();

    const nameInput = screen.getByPlaceholderText('Ex: Gestion des clients');
    const descriptionInput = screen.getByPlaceholderText('Description détaillée du traitement...');
    const legalSelect = screen.getByLabelText('Base légale');

    fireEvent.change(nameInput, { target: { value: 'Prospection B2B' } });
    fireEvent.change(descriptionInput, { target: { value: 'Campagnes email auprès des prospects' } });
    fireEvent.change(legalSelect, { target: { value: 'interets_legitimes' } });

    expect(screen.getByRole('button', { name: /créer le traitement/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /créer le traitement/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      nom: 'Prospection B2B',
      description: 'Campagnes email auprès des prospects',
      base_legale: 'interets_legitimes',
      finalites: [],
      categories_donnees: [],
      categories_personnes: [],
      donnees_sensibles: false,
    });

    await waitFor(() => {
      expect(screen.queryByText('Nouveau traitement de données')).not.toBeInTheDocument();
    });
  });

  it('réinitialise le formulaire après création réussie', async () => {
    renderWithClient(<RgpdTraitementsTab traitements={TRAITEMENTS} />);

    fireEvent.click(screen.getByRole('button', { name: /nouveau traitement/i }));

    fireEvent.change(screen.getByPlaceholderText('Ex: Gestion des clients'), {
      target: { value: 'Traitement temporaire' },
    });
    fireEvent.change(screen.getByPlaceholderText('Description détaillée du traitement...'), {
      target: { value: 'Texte temporaire' },
    });

    fireEvent.click(screen.getByRole('button', { name: /créer le traitement/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /nouveau traitement/i }));

    const reopenedNameInput = screen.getByPlaceholderText('Ex: Gestion des clients') as HTMLInputElement;
    const reopenedDescriptionInput = screen.getByPlaceholderText('Description détaillée du traitement...') as HTMLTextAreaElement;
    const reopenedSelect = screen.getByLabelText('Base légale') as HTMLSelectElement;

    expect(reopenedNameInput.value).toBe('');
    expect(reopenedDescriptionInput.value).toBe('');
    expect(reopenedSelect.value).toBe('contrat');
  });
});