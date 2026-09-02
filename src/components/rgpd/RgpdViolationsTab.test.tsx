// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { format, parseISO } from 'date-fns';
import { RgpdViolationsTab } from './RgpdViolationsTab';

const {
  VIOLATIONS,
  LABELS,
  COLORS,
  mutateAsyncMock,
} = vi.hoisted(() => ({
  VIOLATIONS: [
    {
      id: 'v1',
      numero: 'V-2024-001',
      titre: 'Accès non autorisé',
      severite: 'elevee',
      date_detection: '2024-05-10T14:30:00.000Z',
      notification_cnil_requise: true,
      date_notification_cnil: null,
      statut: 'ouverte',
    },
    {
      id: 'v2',
      numero: 'V-2024-002',
      titre: 'Envoi au mauvais destinataire',
      severite: 'moyenne',
      date_detection: '2024-05-11T09:15:00.000Z',
      notification_cnil_requise: true,
      date_notification_cnil: '2024-05-12T08:00:00.000Z',
      statut: 'en_cours',
    },
    {
      id: 'v3',
      numero: 'V-2024-003',
      titre: 'Incident mineur',
      severite: 'faible',
      date_detection: '2024-05-12T11:45:00.000Z',
      notification_cnil_requise: false,
      date_notification_cnil: null,
      statut: 'cloturee',
    },
  ],
  LABELS: {
    faible: 'Faible',
    moyenne: 'Moyenne',
    elevee: 'Élevée',
    critique: 'Critique',
  },
  COLORS: {
    faible: 'bg-slate-100 text-slate-800',
    moyenne: 'bg-yellow-100 text-yellow-800',
    elevee: 'bg-orange-100 text-orange-800',
    critique: 'bg-red-100 text-red-800',
  },
  mutateAsyncMock: vi.fn(),
}));

vi.mock('@/types/rgpd', () => ({
  VIOLATION_SEVERITE_LABELS: LABELS,
  VIOLATION_SEVERITE_COLORS: COLORS,
}));

vi.mock('@/hooks/auth/useRgpd', () => ({
  useCreateRgpdViolation: () => ({
    mutateAsync: mutateAsyncMock,
  }),
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <svg data-testid="alert-triangle" />,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
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
    <span data-testid="badge" data-class={className} data-variant={variant}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  }) => <textarea value={value} onChange={onChange} />,
}));

vi.mock('@/components/ui/select', () => {
  const ReactModule = React;
  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
    }) => {
      const items: Array<{ value: string; label: string }> = [];
      ReactModule.Children.forEach(children, (child) => {
        if (!ReactModule.isValidElement(child)) return;
        // Scan SelectContent -> SelectItem elements
        if (child.props && child.props.children) {
          ReactModule.Children.forEach(child.props.children, (nested) => {
            if (!ReactModule.isValidElement(nested)) return;
            if (nested.props && nested.props.children) {
              ReactModule.Children.forEach(nested.props.children, (item) => {
                if (!ReactModule.isValidElement(item)) return;
                // item is SelectItem element
                if (typeof item.props.value === 'string') {
                  items.push({ value: item.props.value, label: String(item.props.children) });
                }
              });
            }
          });
        }
      });

      return (
        <select
          aria-label="Sévérité"
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
        >
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      );
    },
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
      <option value={value}>{children}</option>
    ),
  };
});

vi.mock('@/components/ui/dialog', () => {
  const ReactModule = React;
  return {
    Dialog: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: React.ReactNode;
    }) => (
      <div data-testid="dialog-root" data-open={String(open)}>
        {ReactModule.Children.map(children, (child) => {
          if (!ReactModule.isValidElement(child)) return child;
          return ReactModule.cloneElement(child, { open, onOpenChange });
        })}
      </div>
    ),
    DialogTrigger: ({
      children,
      onOpenChange,
    }: {
      children: React.ReactElement<{ onClick?: () => void }>;
      onOpenChange?: (open: boolean) => void;
      asChild?: boolean;
    }) =>
      ReactModule.cloneElement(children, {
        onClick: () => onOpenChange?.(true),
      }),
    DialogContent: ({
      children,
      open,
    }: {
      children: React.ReactNode;
      open?: boolean;
    }) => (open ? <div>{children}</div> : null),
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  };
});

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
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
}));

describe('RgpdViolationsTab', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ id: 'created-1' });
  });

  it('affiche le titre, les colonnes et le message vide quand aucune violation n’est fournie', () => {
    render(<RgpdViolationsTab violations={[]} />);

    expect(screen.getByText('Registre des violations')).toBeInTheDocument();
    expect(screen.getByText('Déclarer une violation')).toBeInTheDocument();
    expect(screen.getByText('Numéro')).toBeInTheDocument();
    expect(screen.getByText('Titre')).toBeInTheDocument();
    expect(screen.getByText('Sévérité')).toBeInTheDocument();
    expect(screen.getByText('Date détection')).toBeInTheDocument();
    expect(screen.getByText('CNIL')).toBeInTheDocument();
    expect(screen.getByText('Statut')).toBeInTheDocument();
    expect(screen.getByText('Aucune violation enregistrée')).toBeInTheDocument();
  });

  it('affiche les violations avec les libellés métier réels de sévérité, CNIL et statut', () => {
    render(<RgpdViolationsTab violations={VIOLATIONS} />);

    expect(screen.getByText('V-2024-001')).toBeInTheDocument();
    expect(screen.getByText('Accès non autorisé')).toBeInTheDocument();
    expect(screen.getByText('Élevée')).toBeInTheDocument();
    expect(screen.getByText('À notifier')).toBeInTheDocument();
    expect(screen.getByText('Ouverte')).toBeInTheDocument();

    expect(screen.getByText('V-2024-002')).toBeInTheDocument();
    expect(screen.getByText('Envoi au mauvais destinataire')).toBeInTheDocument();
    expect(screen.getByText('Moyenne')).toBeInTheDocument();
    expect(screen.getByText('Notifiée')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();

    expect(screen.getByText('V-2024-003')).toBeInTheDocument();
    expect(screen.getByText('Incident mineur')).toBeInTheDocument();
    expect(screen.getByText('Faible')).toBeInTheDocument();
    expect(screen.getByText('Non requise')).toBeInTheDocument();
    expect(screen.getByText('Clôturée')).toBeInTheDocument();

    for (const violation of VIOLATIONS) {
      expect(screen.getByText(format(parseISO(violation.date_detection), 'dd/MM/yyyy HH:mm'))).toBeInTheDocument();
    }
  });

  it('ouvre la modale, active le bouton de déclaration quand les champs requis sont remplis et appelle la mutation avec les bonnes données', async () => {
    render(<RgpdViolationsTab violations={VIOLATIONS} />);

    fireEvent.click(screen.getByText('Déclarer une violation'));

    expect(screen.getByText('Déclarer une violation de données')).toBeInTheDocument();
    expect(screen.getByText('Notification requise à la CNIL sous 72h si nécessaire')).toBeInTheDocument();

    const declareButtonsBefore = screen.getAllByRole('button', { name: 'Déclarer' });
    const submitBefore = declareButtonsBefore[declareButtonsBefore.length - 1];
    expect(submitBefore).toBeDisabled();

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Fuite email' } });
    fireEvent.change(inputs[1], { target: { value: 'Des données ont été exposées par erreur.' } });
    // Ne modifie pas la sévérité: on vérifie la valeur par défaut 'moyenne'
    fireEvent.change(inputs[2], { target: { value: 'Erreur humaine' } });

    const declareButtonsAfter = screen.getAllByRole('button', { name: 'Déclarer' });
    const submitAfter = declareButtonsAfter[declareButtonsAfter.length - 1];
    expect(submitAfter).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(submitAfter);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        titre: 'Fuite email',
        description: 'Des données ont été exposées par erreur.',
        severite: 'moyenne',
        origine: 'Erreur humaine',
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Déclarer une violation de données')).not.toBeInTheDocument();
    });
  });

  it('ferme la modale avec Annuler sans appeler la mutation', async () => {
    render(<RgpdViolationsTab violations={VIOLATIONS} />);

    fireEvent.click(screen.getByText('Déclarer une violation'));
    expect(screen.getByText('Déclarer une violation de données')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Annuler'));

    await waitFor(() => {
      expect(screen.queryByText('Déclarer une violation de données')).not.toBeInTheDocument();
    });

    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});