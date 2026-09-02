// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import SignatureTimeline from './SignatureTimeline';

const { signatureLabels } = vi.hoisted(() => ({
  signatureLabels: {
    created: 'Créé',
    sent: 'Envoyé',
    opened: 'Ouvert',
    viewed: 'Consulté',
    signed: 'Signé',
    completed: 'Terminé',
    refused: 'Refusé',
    expired: 'Expiré',
    reminded: 'Relancé',
    cancelled: 'Annulé',
    error: 'Erreur',
  } as Record<string, string>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
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

vi.mock('lucide-react', () => ({
  Activity: ({ className }: { className?: string }) => <svg data-testid="activity-icon" className={className} />,
}));

vi.mock('@/types/signature', () => ({
  SIGNATURE_EVENT_LABELS: signatureLabels,
}));

describe('SignatureTimeline', () => {
  it('affiche le message vide quand aucun événement n’est présent', () => {
    render(<SignatureTimeline events={[]} />);

    expect(screen.getByTestId('card-title')).toHaveTextContent('Historique de la signature');
    expect(screen.getByTestId('activity-icon')).toBeInTheDocument();
    expect(screen.getByText('Aucun événement enregistré pour le moment.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('affiche la timeline avec les labels métiers, dates formatées et informations signataire', () => {
    const events = [
      {
        id: 'evt-1',
        event_type: 'sent',
        created_at: '2024-01-15T10:30:00.000Z',
        signer_name: 'Jean Dupont',
        signer_email: 'jean@example.test',
        ip_address: '192.168.1.10',
      },
      {
        id: 'evt-2',
        event_type: 'signed',
        created_at: '2024-02-20T14:05:00.000Z',
        signer_name: null,
        signer_email: 'marie@example.test',
        ip_address: null,
      },
      {
        id: 'evt-3',
        event_type: 'custom_event',
        created_at: '2024-03-01T08:00:00.000Z',
        signer_name: 'Invité',
        signer_email: null,
        ip_address: '10.0.0.5',
      },
    ];

    const { container } = render(<SignatureTimeline events={events} />);

    const list = container.querySelector('ol');
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll('li')).toHaveLength(3);

    expect(screen.getByText('Envoyé')).toBeInTheDocument();
    expect(screen.getByText('Signé')).toBeInTheDocument();
    expect(screen.getByText('custom_event')).toBeInTheDocument();

    expect(screen.getByText(format(new Date(events[0].created_at), 'dd/MM/yyyy HH:mm', { locale: fr }))).toBeInTheDocument();
    expect(screen.getByText(format(new Date(events[1].created_at), 'dd/MM/yyyy HH:mm', { locale: fr }))).toBeInTheDocument();
    expect(screen.getByText(format(new Date(events[2].created_at), 'dd/MM/yyyy HH:mm', { locale: fr }))).toBeInTheDocument();

    expect(screen.getByText('Jean Dupont · jean@example.test')).toBeInTheDocument();
    expect(screen.getByText('marie@example.test')).toBeInTheDocument();
    expect(screen.getByText('Invité')).toBeInTheDocument();

    expect(screen.getByText('IP 192.168.1.10')).toBeInTheDocument();
    expect(screen.getByText('IP 10.0.0.5')).toBeInTheDocument();
    expect(screen.getAllByTestId('badge')).toHaveLength(2);
  });

  it('applique la couleur par défaut pour un type inconnu et les couleurs prévues pour les types connus', () => {
    const events = [
      {
        id: 'evt-known',
        event_type: 'signed',
        created_at: '2024-04-10T09:15:00.000Z',
        signer_name: null,
        signer_email: null,
        ip_address: null,
      },
      {
        id: 'evt-unknown',
        event_type: 'unexpected_type',
        created_at: '2024-04-11T11:45:00.000Z',
        signer_name: null,
        signer_email: null,
        ip_address: null,
      },
    ];

    const { container } = render(<SignatureTimeline events={events} />);

    const dots = Array.from(container.querySelectorAll('li > div:first-child'));
    expect(dots).toHaveLength(2);
    expect(dots[0].className).toContain('bg-indigo-500');
    expect(dots[1].className).toContain('bg-gray-400');
  });
});