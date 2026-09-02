import React from 'react';
import { render, screen } from '@testing-library/react';
import { DpoHebergementSection } from './DpoHebergementSection';

vi.mock('@/components/ui/card', () => {
  const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  );
  const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  );
  return { Card, CardContent };
});

vi.mock('@/components/formations/CharterSectionHeader', () => {
  const CharterSectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="charter-header">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
  return { CharterSectionHeader };
});

vi.mock('lucide-react', () => {
  const Server = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="server-icon" {...props} />
  );
  return { Server };
});

vi.mock('@/lib/dpo-content', () => ({}));

const { ITEMS } = vi.hoisted(() => ({
  ITEMS: [
    {
      title: 'Hébergeur certifié',
      description: 'Les données sont hébergées sur des serveurs certifiés.',
      icon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg data-testid="item-icon-1" {...props} />
      ),
    },
    {
      title: 'Redondance géographique',
      description: 'Infrastructure répartie sur plusieurs zones.',
      icon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg data-testid="item-icon-2" {...props} />
      ),
    },
  ],
}));

describe('DpoHebergementSection', () => {
  it('affiche le header avec le bon titre et sous-titre', () => {
    render(<DpoHebergementSection items={ITEMS} />);

    expect(screen.getByTestId('charter-header')).toBeInTheDocument();
    expect(screen.getByText('Hébergement & Infrastructure')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Une infrastructure certifiée pour la protection de vos données de santé',
      ),
    ).toBeInTheDocument();
  });

  it('rend une carte par item avec le bon contenu', () => {
    render(<DpoHebergementSection items={ITEMS} />);

    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(ITEMS.length);

    ITEMS.forEach((item) => {
      expect(screen.getByText(item.title)).toBeInTheDocument();
      expect(screen.getByText(item.description)).toBeInTheDocument();
    });
  });

  it('utilise les icônes des items pour chaque carte', () => {
    render(<DpoHebergementSection items={ITEMS} />);

    expect(screen.getByTestId('item-icon-1')).toBeInTheDocument();
    expect(screen.getByTestId('item-icon-2')).toBeInTheDocument();
  });

  it('applique les classes utilitaires attendues sur le layout principal', () => {
    render(<DpoHebergementSection items={ITEMS} />);

    const grid = screen.getByTestId('charter-header').nextSibling as HTMLElement | null;
    expect(grid).not.toBeNull();
    if (grid) {
      expect(grid.className).toContain('grid');
      expect(grid.className).toContain('grid-cols-1');
      expect(grid.className).toContain('md:grid-cols-2');
      expect(grid.className).toContain('gap-6');
    }
  });

  it('rend un état vide sans crasher quand la liste est vide', () => {
    render(<DpoHebergementSection items={[]} />);

    expect(screen.getByTestId('charter-header')).toBeInTheDocument();
    const cards = screen.queryAllByTestId('card');
    expect(cards).toHaveLength(0);
  });
});