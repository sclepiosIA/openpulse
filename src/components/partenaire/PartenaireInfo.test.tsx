import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartenaireInfo } from './PartenaireInfo';

const { Card, CardHeader, CardTitle, CardContent, Badge, Icon } = vi.hoisted(() => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  Badge: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span data-testid="badge" className={className} data-variant={variant}>
      {children}
    </span>
  ),
  Icon: (props: Record<string, unknown>) => <span data-testid="icon" {...props} />,
}));

vi.mock('@/components/ui/card', () => ({ Card, CardHeader, CardTitle, CardContent }));
vi.mock('@/components/ui/badge', () => ({ Badge }));
vi.mock('lucide-react', () => ({
  MapPin: Icon,
  Phone: Icon,
  Mail: Icon,
  Globe: Icon,
  Calendar: Icon,
  TrendingUp: Icon,
  Target: Icon,
  User: Icon,
  Server: Icon,
}));
vi.mock('@/hooks/crm/usePartenaires', () => ({ Partenaire: {} }));

describe('PartenaireInfo', () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  it('renders all fields correctly with full data', () => {
    const partenaireFull = {
      type_partenaire: 'Entreprise',
      sous_type: 'Générique',
      adresse: '123 Rue Exemple',
      code_postal: '75001',
      ville: 'Paris',
      region: 'Île-de-France',
      telephone: '+33 1 99 00 12 34',
      email: 'contact@example.com',
      site_web: 'https://example.com',
      email_domains: ['exemple.com', 'domain.org'],
      statut_relation: 'actif',
      date_debut_partenariat: '2020-01-01',
      date_fin_partenariat: '2022-12-31',
      responsable: { prenom: 'Marie', nom: 'Dupont' },
      valeur_partenariat: 123456.78,
      engagement_score: 72,
      notes: 'Note de test pour le partenaire.',
      tags: ['tag1', 'tag2'],
    };

    render(<PartenaireInfo partenaire={partenaireFull} />, { wrapper });

    expect(screen.getByText('Informations générales')).toBeInTheDocument();

    expect(screen.getByText(partenaireFull.type_partenaire)).toBeInTheDocument();
    expect(screen.getByText(partenaireFull.sous_type)).toBeInTheDocument();

    expect(screen.getByText('Adresse')).toBeInTheDocument();
    expect(screen.getByText(partenaireFull.adresse)).toBeInTheDocument();
    expect(screen.getByText(`${partenaireFull.code_postal} ${partenaireFull.ville}`)).toBeInTheDocument();
    expect(screen.getByText(partenaireFull.region)).toBeInTheDocument();

    const telLink = screen.getByText(partenaireFull.telephone);
    expect(telLink).toBeInTheDocument();
    expect((telLink as HTMLAnchorElement).getAttribute('href')).toBe(`tel:${partenaireFull.telephone}`);

    const emailLink = screen.getByText(partenaireFull.email);
    expect(emailLink).toBeInTheDocument();
    expect((emailLink as HTMLAnchorElement).getAttribute('href')).toBe(`mailto:${partenaireFull.email}`);

    const siteLink = screen.getByText(partenaireFull.site_web);
    expect(siteLink).toBeInTheDocument();
    expect((siteLink as HTMLAnchorElement).getAttribute('href')).toBe(partenaireFull.site_web);

    expect(screen.getByText('Domaines email')).toBeInTheDocument();
    expect(screen.getByText(partenaireFull.email_domains[0])).toBeInTheDocument();
    expect(screen.getByText(partenaireFull.email_domains[1])).toBeInTheDocument();

    expect(screen.getByText('Statut')).toBeInTheDocument();
    const statutText = screen.getByText(partenaireFull.statut_relation);
    expect(statutText).toBeInTheDocument();
    const statutBadge = statutText.closest('[data-testid="badge"]');
    expect(statutBadge?.getAttribute('data-variant')).toBe('default');

    const debut = new Date(partenaireFull.date_debut_partenariat).toLocaleDateString('fr-FR');
    const fin = new Date(partenaireFull.date_fin_partenariat).toLocaleDateString('fr-FR');
    expect(screen.getByText(`Début : ${debut}`)).toBeInTheDocument();
    expect(screen.getByText(`Fin : ${fin}`)).toBeInTheDocument();

    expect(screen.getByText(`Responsable : ${partenaireFull.responsable.prenom} ${partenaireFull.responsable.nom}`)).toBeInTheDocument();

    expect(screen.getByText(/Valeur estimée/)).toBeInTheDocument();
    expect(screen.getByText(/€/)).toBeInTheDocument();

    expect(screen.getByText("Score d'engagement")).toBeInTheDocument();
    expect(screen.getByText(`${partenaireFull.engagement_score}%`)).toBeInTheDocument();

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText(partenaireFull.notes)).toBeInTheDocument();

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText(partenaireFull.tags[0])).toBeInTheDocument();
    expect(screen.getByText(partenaireFull.tags[1])).toBeInTheDocument();
  });

  it('renders correctly when optional fields are missing', () => {
    const minimal = {
      type_partenaire: 'Association',
      statut_relation: 'prospect',
      engagement_score: 0,
    };

    render(<PartenaireInfo partenaire={minimal as unknown as any} />, { wrapper });

    expect(screen.getByText('Informations générales')).toBeInTheDocument();
    expect(screen.getByText(minimal.type_partenaire)).toBeInTheDocument();

    expect(screen.queryByText('Adresse')).toBeNull();
    expect(screen.queryByText('Domaines email')).toBeNull();
    expect(screen.getByText('Statut')).toBeInTheDocument();

    const statutText = screen.getByText(minimal.statut_relation);
    expect(statutText).toBeInTheDocument();
    const statutBadge = statutText.closest('[data-testid="badge"]');
    expect(statutBadge?.getAttribute('data-variant')).toBe('secondary');

    expect(screen.getByText("Score d'engagement")).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();

    expect(screen.queryByText('Notes')).toBeNull();
    expect(screen.queryByText('Tags')).toBeNull();
  });
})