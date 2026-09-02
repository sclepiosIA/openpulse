import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RHExportPaie } from '@/components/rh/RHExportPaie';

const mockSalaires = [
  {
    id: 's1',
    salaire_brut: 3500,
    salaire_net: 2700,
    cotisations_patronales: 1200,
    cotisations_salariales: 800,
    primes: 200,
    heures_supplementaires: 0,
    profiles: { nom: 'Dupont', prenom: 'Jean', email: 'jean@test.com' },
  },
];

vi.mock('@/hooks/hr/useRHSalaires', () => ({
  useRHSalaires: () => ({
    salaires: mockSalaires,
    isLoading: false,
  }),
}));

describe('RHExportPaie', () => {
  it('renders export section', () => {
    render(<RHExportPaie />);
    expect(screen.getByText('Exports RH')).toBeInTheDocument();
    expect(screen.getByText('Exporter en CSV')).toBeInTheDocument();
    expect(screen.getByText('Exporter en Excel')).toBeInTheDocument();
  });

  it('renders bulletins section', () => {
    render(<RHExportPaie />);
    expect(screen.getByText('Bulletins de paie')).toBeInTheDocument();
    expect(screen.getByText('Générer les bulletins de paie')).toBeInTheDocument();
  });

  it('renders month selector', () => {
    render(<RHExportPaie />);
    expect(screen.getByText('Mois à exporter')).toBeInTheDocument();
  });

  it('renders recap when salaires available', () => {
    render(<RHExportPaie />);
    expect(screen.getByText(/Récapitulatif/)).toBeInTheDocument();
    expect(screen.getByText("Nombre d'employés:")).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('exports CSV on click', () => {
    // Mock URL.createObjectURL and link click
    const mockCreateObjectURL = vi.fn(() => 'blob:test');
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    render(<RHExportPaie />);
    fireEvent.click(screen.getByText('Exporter en CSV'));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });
});
