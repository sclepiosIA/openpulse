// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComptesAccesChecklist } from './ComptesAccesChecklist';

const { checkboxPropsById, labelHtmlFor, cardChildren } = vi.hoisted(() => ({
  checkboxPropsById: new Map<string, { checked: boolean; onCheckedChange: (checked: boolean) => void }>(),
  labelHtmlFor: new Map<string, string>(),
  cardChildren: [] as React.ReactNode[],
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section data-testid="card">{children}</section>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <header data-testid="card-header">{children}</header>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => {
    checkboxPropsById.set(id, { checked, onCheckedChange });
    return (
      <button
        type="button"
        role="checkbox"
        id={id}
        aria-checked={checked}
        data-testid={`checkbox-${id}`}
        onClick={() => onCheckedChange(!checked)}
      >
        {id}
      </button>
    );
  },
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor: string;
    className?: string;
  }) => {
    labelHtmlFor.set(htmlFor, String(children));
    return (
      <label htmlFor={htmlFor} className={className}>
        {children}
      </label>
    );
  },
}));

vi.mock('lucide-react', () => ({
  Key: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="key-icon" {...props} />,
}));

describe('ComptesAccesChecklist', () => {
  beforeEach(() => {
    checkboxPropsById.clear();
    labelHtmlFor.clear();
  });

  it('affiche le titre, l’icône, le compteur métier et les 18 comptes configurés', () => {
    const onUpdate = vi.fn();

    render(
      <ComptesAccesChecklist
        comptes={{
          mail: true,
          vpn: false,
          google_workspace: true,
          ssh: true,
        }}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText('Comptes et accès')).toBeInTheDocument();
    expect(screen.getByTestId('key-icon')).toBeInTheDocument();
    expect(screen.getByText('3 / 18 activés')).toBeInTheDocument();

    expect(screen.getByText('Mail professionnel')).toBeInTheDocument();
    expect(screen.getByText('VPN')).toBeInTheDocument();
    expect(screen.getByText('Bookstack')).toBeInTheDocument();
    expect(screen.getByText('Passbolt')).toBeInTheDocument();
    expect(screen.getByText('EspoCRM')).toBeInTheDocument();
    expect(screen.getByText('Google Workspace')).toBeInTheDocument();
    expect(screen.getByText('Penpot')).toBeInTheDocument();
    expect(screen.getByText('Nextcloud')).toBeInTheDocument();
    expect(screen.getByText('Gitea')).toBeInTheDocument();
    expect(screen.getByText('Kimai')).toBeInTheDocument();
    expect(screen.getByText('Cal.com')).toBeInTheDocument();
    expect(screen.getByText('Accès SSH')).toBeInTheDocument();
    expect(screen.getByText('Azure')).toBeInTheDocument();
    expect(screen.getByText('OVH')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Réseaux sociaux')).toBeInTheDocument();
    expect(screen.getByText('Ausha')).toBeInTheDocument();
    expect(screen.getByText('Brevo')).toBeInTheDocument();

    expect(screen.getAllByRole('checkbox')).toHaveLength(18);
  });

  it('passe false par défaut pour les comptes absents et true pour les comptes actifs', () => {
    const onUpdate = vi.fn();

    render(
      <ComptesAccesChecklist
        comptes={{
          mail: true,
          vpn: false,
        }}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByTestId('checkbox-mail')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('checkbox-vpn')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkbox-bookstack')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkbox-openai')).toHaveAttribute('aria-checked', 'false');
  });

  it('déclenche onUpdate avec l’objet métier fusionné quand on active un accès inactif', () => {
    const onUpdate = vi.fn();
    const comptes = {
      mail: true,
      vpn: false,
      ssh: false,
    };

    render(<ComptesAccesChecklist comptes={comptes} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('checkbox-vpn'));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      mail: true,
      vpn: true,
      ssh: false,
    });
  });

  it('déclenche onUpdate avec false quand on désactive un accès actif', () => {
    const onUpdate = vi.fn();
    const comptes = {
      mail: true,
      vpn: true,
      google_workspace: true,
    };

    render(<ComptesAccesChecklist comptes={comptes} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('checkbox-google_workspace'));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      mail: true,
      vpn: true,
      google_workspace: false,
    });
  });

  it('associe chaque label au bon identifiant htmlFor', () => {
    render(<ComptesAccesChecklist comptes={{}} onUpdate={vi.fn()} />);

    expect(labelHtmlFor.get('mail')).toBe('Mail professionnel');
    expect(labelHtmlFor.get('vpn')).toBe('VPN');
    expect(labelHtmlFor.get('bookstack')).toBe('Bookstack');
    expect(labelHtmlFor.get('passbolt')).toBe('Passbolt');
    expect(labelHtmlFor.get('espocrm')).toBe('EspoCRM');
    expect(labelHtmlFor.get('google_workspace')).toBe('Google Workspace');
    expect(labelHtmlFor.get('penpot')).toBe('Penpot');
    expect(labelHtmlFor.get('nextcloud')).toBe('Nextcloud');
    expect(labelHtmlFor.get('gitea')).toBe('Gitea');
    expect(labelHtmlFor.get('kimai')).toBe('Kimai');
    expect(labelHtmlFor.get('calcom')).toBe('Cal.com');
    expect(labelHtmlFor.get('ssh')).toBe('Accès SSH');
    expect(labelHtmlFor.get('azure')).toBe('Azure');
    expect(labelHtmlFor.get('ovh')).toBe('OVH');
    expect(labelHtmlFor.get('openai')).toBe('OpenAI');
    expect(labelHtmlFor.get('reseaux_sociaux')).toBe('Réseaux sociaux');
    expect(labelHtmlFor.get('ausha')).toBe('Ausha');
    expect(labelHtmlFor.get('brevo')).toBe('Brevo');
  });

  it('recalcule correctement le compteur quand aucun compte puis tous les comptes sont actifs', () => {
    const { rerender } = render(<ComptesAccesChecklist comptes={{}} onUpdate={vi.fn()} />);

    expect(screen.getByText('0 / 18 activés')).toBeInTheDocument();

    rerender(
      <ComptesAccesChecklist
        comptes={{
          mail: true,
          vpn: true,
          bookstack: true,
          passbolt: true,
          espocrm: true,
          google_workspace: true,
          penpot: true,
          nextcloud: true,
          gitea: true,
          kimai: true,
          calcom: true,
          ssh: true,
          azure: true,
          ovh: true,
          openai: true,
          reseaux_sociaux: true,
          ausha: true,
          brevo: true,
        }}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText('18 / 18 activés')).toBeInTheDocument();
  });
});