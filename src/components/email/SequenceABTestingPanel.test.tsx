// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SequenceABTestingPanel } from './SequenceABTestingPanel';

const {
  VARIANTS,
  loadingState,
  designateState,
  deleteState,
  upsertState,
  useSequenceVariantsMock,
  useDesignateWinnersMock,
  useDeleteVariantMock,
  useUpsertVariantMock,
} = vi.hoisted(() => {
  const VARIANTS = [
    {
      id: 'v1',
      sequence_id: 'seq-1',
      step_index: 0,
      variant_label: 'A',
      weight: 60,
      is_active: true,
      is_winner: true,
      subject: 'Sujet Alpha',
      stats: {
        sends_count: 120,
        open_rate: 0.4,
        click_rate: 0.15,
        reply_rate: 0.05,
      },
    },
    {
      id: 'v2',
      sequence_id: 'seq-1',
      step_index: 0,
      variant_label: 'B',
      weight: 40,
      is_active: true,
      is_winner: false,
      subject: 'Sujet Beta',
      stats: {
        sends_count: 80,
        open_rate: 0.25,
        click_rate: 0.1,
        reply_rate: 0.02,
      },
    },
    {
      id: 'v3',
      sequence_id: 'seq-1',
      step_index: 1,
      variant_label: 'A',
      weight: 100,
      is_active: false,
      is_winner: false,
      subject: '',
      stats: {
        sends_count: 30,
        open_rate: 0.1,
        click_rate: 0.03,
        reply_rate: 0.01,
      },
    },
  ] as const;

  const loadingState = { value: false };
  const designateState = {
    isPending: false,
    mutate: vi.fn(),
  };
  const deleteState = {
    isPending: false,
    mutate: vi.fn(),
  };
  const upsertState = {
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'new-1' }, error: null }),
  };

  const useSequenceVariantsMock = vi.fn((sequenceId: string) => ({
    data: sequenceId === 'seq-1' ? VARIANTS : [],
    isLoading: loadingState.value,
    isError: false,
  }));

  const useDesignateWinnersMock = vi.fn(() => designateState);
  const useDeleteVariantMock = vi.fn(() => deleteState);
  const useUpsertVariantMock = vi.fn(() => upsertState);

  return {
    VARIANTS,
    loadingState,
    designateState,
    deleteState,
    upsertState,
    useSequenceVariantsMock,
    useDesignateWinnersMock,
    useDeleteVariantMock,
    useUpsertVariantMock,
  };
});

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <span data-icon="icon" className={className} />;
  return {
    Plus: Icon,
    Trash2: Icon,
    Trophy: Icon,
    FlaskConical: Icon,
    Loader2: Icon,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => {
    const ariaLabelProp = props['aria-label'];
    return (
      <button onClick={props.onClick} disabled={props.disabled} aria-label={ariaLabelProp} type={props.type} className={props.className}>
        {props.children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="progress">{value}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => <div>{children}</div>,
  DialogTrigger: ({
    children,
  }: {
    asChild?: boolean;
    children: React.ReactElement;
  }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/email/useSequenceVariants', () => ({
  useSequenceVariants: useSequenceVariantsMock,
  useUpsertVariant: useUpsertVariantMock,
  useDeleteVariant: useDeleteVariantMock,
  useDesignateWinners: useDesignateWinnersMock,
}));

describe('SequenceABTestingPanel', () => {
  beforeEach(() => {
    loadingState.value = false;
    designateState.isPending = false;
    deleteState.isPending = false;
    upsertState.isPending = false;
    designateState.mutate.mockClear();
    deleteState.mutate.mockClear();
    upsertState.mutateAsync.mockClear();
  });

  it('affiche le chargement quand les variantes sont en cours de récupération', () => {
    loadingState.value = true;

    render(<SequenceABTestingPanel sequenceId="seq-1" stepsCount={2} />);

    expect(screen.getByText('A/B testing')).toBeInTheDocument();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText('Étape 1')).not.toBeInTheDocument();
  });

  it('affiche les étapes, les variantes, les pourcentages et les statistiques métier', () => {
    render(<SequenceABTestingPanel sequenceId="seq-1" stepsCount={3} />);

    expect(screen.getByText('Étape 1')).toBeInTheDocument();
    expect(screen.getByText('Étape 2')).toBeInTheDocument();
    expect(screen.getByText('Étape 3')).toBeInTheDocument();

    expect(screen.getAllByText('Variante A')).toHaveLength(2);
    expect(screen.getByText('Variante B')).toBeInTheDocument();
    expect(screen.getByText('60% du trafic')).toBeInTheDocument();
    expect(screen.getByText('40% du trafic')).toBeInTheDocument();
    expect(screen.getByText('0% du trafic')).toBeInTheDocument();
    expect(screen.getByText('Sujet Alpha')).toBeInTheDocument();
    expect(screen.getByText('Sujet Beta')).toBeInTheDocument();

    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('15%')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();

    expect(screen.getByText('Désactivée')).toBeInTheDocument();
    expect(screen.getByText('Aucune variante — ajoutez-en au moins 2 pour démarrer un A/B test.')).toBeInTheDocument();
  });

  it('déclenche la désignation des gagnants avec le sequence_id attendu', () => {
    render(<SequenceABTestingPanel sequenceId="seq-1" stepsCount={2} />);

    fireEvent.click(screen.getByRole('button', { name: /désigner les gagnants/i }));

    expect(designateState.mutate).toHaveBeenCalledWith({ sequence_id: 'seq-1' });
  });

  it('supprime une variante avec son id et son sequence_id', () => {
    render(<SequenceABTestingPanel sequenceId="seq-1" stepsCount={2} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer' })[0]);

    expect(deleteState.mutate).toHaveBeenCalledWith({ id: 'v1', sequence_id: 'seq-1' });
  });

  it('crée une nouvelle variante avec les valeurs du formulaire', async () => {
    render(<SequenceABTestingPanel sequenceId="seq-1" stepsCount={2} />);

    const labelInput = screen.getAllByDisplayValue('C')[0];
    const weightInput = screen.getAllByDisplayValue('50')[0];
    const subjectInput = screen.getAllByPlaceholderText("Sujet de l'email")[0];
    const bodyInput = screen.getAllByRole('textbox').find((el) => el.tagName.toLowerCase() === 'textarea');

    fireEvent.change(labelInput, { target: { value: 'c' } });
    fireEvent.change(weightInput, { target: { value: '35' } });
    fireEvent.change(subjectInput, { target: { value: 'Sujet test' } });

    if (!bodyInput) {
      throw new Error('Textarea not found');
    }

    fireEvent.change(bodyInput, { target: { value: 'Contenu texte' } });
    fireEvent.click(screen.getAllByRole('button', { name: /enregistrer/i })[0]);

    await waitFor(() => {
      expect(upsertState.mutateAsync).toHaveBeenCalledWith({
        sequence_id: 'seq-1',
        step_index: 0,
        variant_label: 'C',
        weight: 35,
        subject: 'Sujet test',
        body_text: 'Contenu texte',
        is_active: true,
      });
    });
  });
});