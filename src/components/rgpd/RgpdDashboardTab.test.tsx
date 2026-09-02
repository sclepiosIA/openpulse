import React from 'react';
import { render, screen, within } from '@testing-library/react';

const { UI, Icons } = vi.hoisted(() => {
  type DivProps = React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode };
  type SpanProps = React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode; variant?: string };
  const Card = ({ children, ...props }: DivProps) => <div {...props}>{children}</div>;
  const CardContent = ({ children, ...props }: DivProps) => <div {...props}>{children}</div>;
  const CardDescription = ({ children, ...props }: DivProps) => <div {...props}>{children}</div>;
  const CardHeader = ({ children, ...props }: DivProps) => <div {...props}>{children}</div>;
  const CardTitle = ({ children, ...props }: DivProps) => <div {...props}>{children}</div>;
  const Badge = ({ children, variant, ...props }: SpanProps) => (
    <span data-testid="badge" data-variant={variant} {...props}>
      {children}
    </span>
  );
  const FileText = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-filetext" {...props} />;
  const Users = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-users" {...props} />;
  const AlertTriangle = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-alert" {...props} />;
  const Award = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-award" {...props} />;
  const Clock = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-clock" {...props} />;
  const CheckCircle2 = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />;
  return {
    UI: { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge },
    Icons: { FileText, Users, AlertTriangle, Award, Clock, CheckCircle2 },
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: UI.Card,
  CardContent: UI.CardContent,
  CardDescription: UI.CardDescription,
  CardHeader: UI.CardHeader,
  CardTitle: UI.CardTitle,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: UI.Badge,
}));

vi.mock('lucide-react', () => ({
  FileText: Icons.FileText,
  Users: Icons.Users,
  AlertTriangle: Icons.AlertTriangle,
  Award: Icons.Award,
  Clock: Icons.Clock,
  CheckCircle2: Icons.CheckCircle2,
}));

import { RgpdDashboardTab } from './RgpdDashboardTab';

describe('RgpdDashboardTab', () => {
  it('affiche les KPIs et les états conditionnels (valeurs > 0)', () => {
    const kpis = {
      traitements_actifs: 12,
      traitements_sensibles: 3,
      demandes_en_cours: 5,
      demandes_en_retard: 2,
      violations_ouvertes: 1,
      certifications_valides: 7,
      certifications_expirant_bientot: 2,
      dpia_en_attente: 4,
      dpa_actifs: 6,
      dpa_expirant_bientot: 1,
    };

    render(<RgpdDashboardTab kpis={kpis} />);

    // Tuiles principales
    expect(screen.getByText('Traitements actifs')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3 avec données sensibles')).toBeTruthy();

    expect(screen.getByText('Demandes de droits')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    const retard = screen.getByText('2 en retard');
    expect(retard).toBeTruthy();
    expect(retard.className).toContain('text-destructive');

    expect(screen.getByText('Violations ouvertes')).toBeTruthy();
    const followUp = screen.getByText('Nécessitent un suivi');
    expect(followUp).toBeTruthy();
    const violContainer = followUp.parentElement as HTMLElement;
    expect(within(violContainer).getByText('1')).toBeTruthy();

    expect(screen.getByText('Certifications')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    const expSoon = screen.getByText('2 expire(nt) bientôt');
    expect(expSoon).toBeTruthy();
    expect(expSoon.className).toContain('text-warning');

    // DPIA
    expect(screen.getByText("DPIA en attente")).toBeTruthy();
    const dpiaPendingText = screen.getByText('4 DPIA en attente');
    expect(dpiaPendingText).toBeTruthy();
    expect(dpiaPendingText.parentElement?.className || '').toContain('text-warning');

    // Sous-traitants (DPA)
    expect(screen.getByText('Sous-traitants (DPA)')).toBeTruthy();
    expect(screen.getByText('DPA actifs')).toBeTruthy();
    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBe(2);
    expect(badges[0].getAttribute('data-variant')).toBe('outline');
    expect(badges[0].textContent).toBe('6');

    expect(screen.getByText('Expirant dans 90 jours')).toBeTruthy();
    expect(badges[1].getAttribute('data-variant')).toBe('destructive');
    expect(badges[1].textContent).toBe('1');

    // Descriptions
    expect(screen.getByText("Analyses d'impact requises mais non réalisées")).toBeTruthy();
    expect(screen.getByText('Contrats de sous-traitance actifs')).toBeTruthy();
  });

  it("affiche l'absence d'alertes lorsque les compteurs sont à 0", () => {
    const kpis = {
      traitements_actifs: 0,
      traitements_sensibles: 0,
      demandes_en_cours: 0,
      demandes_en_retard: 0,
      violations_ouvertes: 0,
      certifications_valides: 0,
      certifications_expirant_bientot: 0,
      dpia_en_attente: 0,
      dpa_actifs: 0,
      dpa_expirant_bientot: 0,
    };

    render(<RgpdDashboardTab kpis={kpis} />);

    // Demandes en retard => "Aucune en retard"
    expect(screen.getByText('Aucune en retard')).toBeTruthy();
    expect(screen.queryByText(/^\d+\s+en retard$/)).toBeNull(); // pas de "X en retard"

    // Certifications => "Toutes à jour"
    expect(screen.getByText('Toutes à jour')).toBeTruthy();
    expect(screen.queryByText(/expire\(nt\) bientôt/)).toBeNull();

    // DPIA => "Toutes les DPIA sont à jour"
    expect(screen.getByText('Toutes les DPIA sont à jour')).toBeTruthy();
    expect(screen.queryByText(/^\d+\s+DPIA en attente$/)).toBeNull();

    // DPA expirant bientôt absent
    expect(screen.queryByText('Expirant dans 90 jours')).toBeNull();

    // Un seul badge (DPA actifs)
    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBe(1);
    expect(badges[0].getAttribute('data-variant')).toBe('outline');
    expect(badges[0].textContent).toBe('0');
  });

  it('affiche correctement les en-têtes et sections statiques', () => {
    const kpis = {
      traitements_actifs: 1,
      traitements_sensibles: 1,
      demandes_en_cours: 1,
      demandes_en_retard: 0,
      violations_ouvertes: 1,
      certifications_valides: 1,
      certifications_expirant_bientot: 0,
      dpia_en_attente: 0,
      dpa_actifs: 1,
      dpa_expirant_bientot: 0,
    };

    render(<RgpdDashboardTab kpis={kpis} />);

    expect(screen.getByText('Traitements actifs')).toBeTruthy();
    expect(screen.getByText('Demandes de droits')).toBeTruthy();
    expect(screen.getByText('Violations ouvertes')).toBeTruthy();
    expect(screen.getByText('Certifications')).toBeTruthy();
    expect(screen.getByText("DPIA en attente")).toBeTruthy();
    expect(screen.getByText('Sous-traitants (DPA)')).toBeTruthy();
  });
});