import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { RHSalaireDetail } from './RHSalaireDetail';

vi.mock('@/components/ui/card', () => {
  const Pass = ({ children, ...props }: { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  );
  return {
    Card: Pass,
    CardHeader: Pass,
    CardTitle: Pass,
    CardDescription: Pass,
    CardContent: Pass,
    CardFooter: Pass,
  };
});

// Intl.NumberFormat fr-FR insère des espaces insécables (U+00A0 / U+202F).
// Le normalizer par défaut de Testing Library remplace tout whitespace par
// des espaces simples, donc on normalise aussi la chaîne attendue.
const eur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
    .format(n)
    .replace(/[\u202f\u00a0\s]/g, ' ');

describe('RHSalaireDetail', () => {
  const baseSalaire = {
    profiles: { prenom: 'Marie', nom: 'Dupont' },
    mois: '2024-06',
    salaire_brut: 3000,
    cotisations_salariales: 690,
    cotisations_patronales: 1350,
    salaire_net: 2310,
  };

  it('affiche le titre, la description et les montants de base', () => {
    render(<RHSalaireDetail salaire={baseSalaire} />);

    expect(screen.getByText('Détail du salaire')).toBeTruthy();
    expect(screen.getByText(/Marie\s+Dupont\s+-\s+2024-06/)).toBeTruthy();

    expect(screen.getByText(eur(3000))).toBeTruthy();
    expect(screen.getByText(`-${eur(690)}`)).toBeTruthy();
    expect(screen.getByText(eur(1350))).toBeTruthy();
    expect(screen.getByText('Cotisations patronales (45%)')).toBeTruthy();
  });

  it('utilise salaire_net pour le Net Payé si net_paye est absent', () => {
    render(<RHSalaireDetail salaire={baseSalaire} />);

    expect(screen.getByText('Net Payé')).toBeTruthy();
    expect(screen.getByText(eur(2310))).toBeTruthy();
  });

  it('utilise net_paye en priorité sur salaire_net', () => {
    render(<RHSalaireDetail salaire={{ ...baseSalaire, net_paye: 2500 }} />);

    expect(screen.getByText(eur(2500))).toBeTruthy();
    expect(screen.queryByText(eur(2310))).toBeNull();
  });

  it("n'affiche pas les sections primes et heures supplémentaires quand absentes", () => {
    render(<RHSalaireDetail salaire={baseSalaire} />);

    expect(screen.queryByText('Primes')).toBeNull();
    expect(screen.queryByText('Heures supplémentaires')).toBeNull();
  });

  it('affiche les primes et heures supplémentaires quand fournies', () => {
    render(
      <RHSalaireDetail
        salaire={{ ...baseSalaire, primes: 200, heures_supplementaires: 150 }}
      />
    );

    expect(screen.getByText('Primes')).toBeTruthy();
    expect(screen.getByText(`+${eur(200)}`)).toBeTruthy();
    expect(screen.getByText('Heures supplémentaires')).toBeTruthy();
    expect(screen.getByText(`+${eur(150)}`)).toBeTruthy();
  });

  it('calcule le coût total employeur = brut + cotisations patronales', () => {
    render(<RHSalaireDetail salaire={baseSalaire} />);

    expect(screen.getByText('Coût total employeur')).toBeTruthy();
    expect(screen.getByText(eur(3000 + 1350))).toBeTruthy();
  });

  it('rend sans erreur quand profiles est absent', () => {
    const { profiles: _ignored, ...sansProfil } = baseSalaire;
    render(<RHSalaireDetail salaire={sansProfil} />);

    expect(screen.getByText('Détail du salaire')).toBeTruthy();
    expect(screen.getByText(/2024-06/)).toBeTruthy();
  });
});