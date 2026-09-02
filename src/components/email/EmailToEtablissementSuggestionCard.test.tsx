/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EmailToEtablissementSuggestionCard } from './EmailToEtablissementSuggestionCard';

const { sanitizeEmailSubjectMock, baseSuggestion, createNewSuggestion, duplicateHintSuggestion } = vi.hoisted(() => ({
  sanitizeEmailSubjectMock: vi.fn((value?: string | null) => {
    if (!value) return '';
    return value.replace(/^Re:\s*/i, '').trim();
  }),
  baseSuggestion: {
    id: 'sug-1',
    suggestion_type: 'link_existing',
    match_confidence: 0.84,
    match_reason: 'Correspondance sur le domaine et la ville',
    created_at: '2024-03-02T10:00:00.000Z',
    email_thread: {
      subject: 'Re: Prise de contact clinique',
      ai_summary: 'Re: Discussion avec établissement',
      last_message_date: '2024-03-05T09:30:00.000Z',
    },
    extracted_data: {
      nom: 'Clinique du Lac',
      nom_hint: 'Clinique du Lac',
      ville: 'Lyon',
      ville_hint: 'Lyon',
      type: 'Clinique',
      type_hint: 'Clinique',
      domain: 'clinique-lac.example.org',
      contact_hint: {
        name: 'Marie Martin',
        email: 'marie@clinique-lac.example.org',
      },
    },
  },
  createNewSuggestion: {
    id: 'sug-2',
    suggestion_type: 'create_new',
    match_confidence: 0.55,
    match_reason: 'Nouveau domaine détecté',
    created_at: '2024-01-10T08:00:00.000Z',
    email_thread: {
      subject: 'Re: Opportunité EHPAD',
      ai_summary: '',
      last_message_date: '2024-01-11T12:00:00.000Z',
    },
    extracted_data: {
      nom_hint: 'EHPAD Soleil',
      ville_hint: 'Marseille',
      type_hint: 'EHPAD',
      domain: 'gmail.com',
      contact_hint: {
        name: 'Paul Durand',
        email: 'contact@gmail.com',
      },
    },
  },
  duplicateHintSuggestion: {
    id: 'sug-3',
    suggestion_type: 'link_existing',
    match_confidence: 0.72,
    match_reason: 'Ville repérée dans le fil',
    created_at: '2024-04-01T08:00:00.000Z',
    email_thread: {
      subject: 'Re: Échange Nantes',
      ai_summary: 'Re: Point sur Nantes',
      last_message_date: '2024-04-02T12:00:00.000Z',
    },
    extracted_data: {
      nom: '',
      nom_hint: 'Nantes',
      ville: '',
      ville_hint: 'Nantes',
      type_hint: 'Centre',
      domain: 'contact-example.fr',
      contact_hint: {
        name: 'Claire Petit',
        email: 'claire@contact-example.fr',
      },
    },
  },
}));

vi.mock('@/lib/emailUtils', () => ({
  sanitizeEmailSubject: sanitizeEmailSubjectMock,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg aria-hidden="true" {...props} />;
  return {
    Check: Icon,
    X: Icon,
    Mail: Icon,
    Building2: Icon,
    Calendar: Icon,
    User: Icon,
    TrendingUp: Icon,
    AlertTriangle: Icon,
  };
});

describe('EmailToEtablissementSuggestionCard', () => {
  beforeEach(() => {
    sanitizeEmailSubjectMock.mockClear();
  });

  it('affiche les informations métier principales pour une suggestion de liaison existante', () => {
    render(
      <EmailToEtablissementSuggestionCard
        suggestion={baseSuggestion}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByText('Prise de contact clinique')).toBeInTheDocument();
    expect(screen.getByText('Confiance: 84%')).toBeInTheDocument();
    expect(screen.getByText('Domaine santé')).toBeInTheDocument();
    expect(screen.getByText('Discussion avec établissement')).toBeInTheDocument();
    expect(screen.getByText('Clinique du Lac')).toBeInTheDocument();
    expect(screen.getByText('Lyon')).toBeInTheDocument();
    expect(screen.getByText('Clinique')).toBeInTheDocument();
    expect(screen.getByText('Marie Martin')).toBeInTheDocument();
    expect(screen.getByText('marie@clinique-lac.example.org')).toBeInTheDocument();
    expect(screen.getByText('clinique-lac.example.org')).toBeInTheDocument();
    expect(screen.getByText(/Correspondance sur le domaine et la ville/)).toBeInTheDocument();
    expect(screen.getByText('Reçu le 5 mars 2024')).toBeInTheDocument();

    expect(screen.getAllByText('Lier à établissement')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Lier à établissement/i })).toBeInTheDocument();

    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith('Re: Prise de contact clinique');
    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith('Re: Discussion avec établissement');
  });

  it('affiche les badges et libellés adaptés pour un nouveau prospect avec domaine générique', () => {
    render(
      <EmailToEtablissementSuggestionCard
        suggestion={createNewSuggestion}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByText('Opportunité EHPAD')).toBeInTheDocument();
    expect(screen.getByText('Nouveau prospect')).toBeInTheDocument();
    expect(screen.getByText('Confiance: 55%')).toBeInTheDocument();
    expect(screen.getByText('Domaine générique (suspect)')).toBeInTheDocument();
    expect(screen.getByText('Aucun résumé disponible')).toBeInTheDocument();
    expect(screen.getByText('EHPAD Soleil')).toBeInTheDocument();
    expect(screen.getByText('Marseille')).toBeInTheDocument();
    expect(screen.getByText('EHPAD')).toBeInTheDocument();
    expect(screen.getByText('contact@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer établissement/i })).toBeInTheDocument();
    expect(screen.getByText('Reçu le 11 janvier 2024')).toBeInTheDocument();
  });

  it('déclenche onAccept avec les bons arguments et onReject avec l’identifiant', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    render(
      <EmailToEtablissementSuggestionCard
        suggestion={createNewSuggestion}
        onAccept={onAccept}
        onReject={onReject}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Créer établissement/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledWith({ suggestionId: 'sug-2', createNew: true });

    fireEvent.click(screen.getByRole('button', { name: /Refuser/i }));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith('sug-2');
  });

  it('désactive les actions quand un traitement est en cours', () => {
    render(
      <EmailToEtablissementSuggestionCard
        suggestion={baseSuggestion}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        isAccepting
        isRejecting={false}
      />
    );

    expect(screen.getByRole('button', { name: /Lier à établissement/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Refuser/i })).toBeDisabled();
  });

  it('n’affiche pas le bloc établissement quand nom_hint est identique à ville_hint', () => {
    render(
      <EmailToEtablissementSuggestionCard
        suggestion={duplicateHintSuggestion}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );

    const citySection = screen.getByText('Ville').closest('div');
    expect(citySection).not.toBeNull();
    if (citySection) {
      expect(within(citySection).getByText('Nantes')).toBeInTheDocument();
    }

    expect(screen.queryByText('Établissement')).not.toBeInTheDocument();
    expect(screen.getByText('Centre')).toBeInTheDocument();
    expect(screen.getByText('claire@contact-example.fr')).toBeInTheDocument();
  });
});