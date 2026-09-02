import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockNot = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();

const createChain = (resolvedValue: any) => {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    then: (resolve: any) => resolve(resolvedValue),
  };
  return chain;
};

let mockChains: Record<string, any> = {};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockChains[table] || createChain({ data: [], error: null }),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

describe('calculateAutomaticExpenses', () => {
  beforeEach(() => {
    vi.resetModules();
    mockChains = {};
  });

  it('should export calculateTotalSalairesBruts function', async () => {
    mockChains['rh_salaires_mensuels'] = createChain({
      data: [{ salaire_brut: 3000 }, { salaire_brut: 4000 }],
      error: null,
    });

    const { calculateTotalSalairesBruts } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculateTotalSalairesBruts('2025-06');
    expect(result).toBe(7000);
  });

  it('should fallback to profiles when no rh_salaires_mensuels data', async () => {
    mockChains['rh_salaires_mensuels'] = createChain({ data: [], error: null });
    mockChains['profiles'] = createChain({
      data: [{ salaire_brut: 3500 }, { salaire_brut: 4500 }],
      error: null,
    });

    const { calculateTotalSalairesBruts } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculateTotalSalairesBruts('2025-06');
    expect(result).toBe(8000);
  });

  it('should calculate salaires nets as 78% of brut', async () => {
    mockChains['rh_salaires_mensuels'] = createChain({
      data: [{ salaire_brut: 10000 }],
      error: null,
    });

    const { calculateSalairesNets } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculateSalairesNets('2025-06');
    expect(result).toBe(7800);
  });

  it('should calculate cotisations patronales as 45% of brut', async () => {
    mockChains['rh_salaires_mensuels'] = createChain({
      data: [{ salaire_brut: 10000 }],
      error: null,
    });

    const { calculateCotisationsPatronales } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculateCotisationsPatronales('2025-06');
    expect(result).toBe(4500);
  });

  it('should calculate retraite as 8% of brut', async () => {
    mockChains['rh_salaires_mensuels'] = createChain({
      data: [{ salaire_brut: 10000 }],
      error: null,
    });

    const { calculateRetraite } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculateRetraite('2025-06');
    expect(result).toBe(800);
  });

  it('should calculate prevoyance as 1.5% of brut', async () => {
    mockChains['rh_salaires_mensuels'] = createChain({
      data: [{ salaire_brut: 10000 }],
      error: null,
    });

    const { calculatePrevoyance } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculatePrevoyance('2025-06');
    expect(result).toBe(150);
  });

  it('should calculate mutuelle as 60€ per employee', async () => {
    mockChains['rh_salaires_mensuels'] = createChain({
      data: null,
      error: null,
      count: 5,
    });
    // For count query
    const countChain: any = {
      select: vi.fn(() => countChain),
      eq: vi.fn(() => countChain),
      then: (resolve: any) => resolve({ count: 5, error: null }),
    };
    mockChains['rh_salaires_mensuels'] = countChain;

    const { calculateMutuelle } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculateMutuelle('2025-06');
    expect(result).toBe(300);
  });

  it('should calculate TVA as 15% of CA HT (20% - 5% deductible)', async () => {
    mockChains['tresorerie_revenus'] = createChain({
      data: [
        { montant_prevu: 10000, statut: 'paye' },
        { montant_prevu: 5000, statut: 'en_attente' },
      ],
      error: null,
    });

    const { calculateTVA } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculateTVA(new Date('2025-06-15'));
    // Only 'paye' = 10000, TVA = 10000 * 0.15 = 1500
    expect(result).toBe(1500);
  });

  it('should calculate CA HT from paid revenues only', async () => {
    const chain = createChain({
      data: [
        { montant_prevu: 8000, statut: 'paye' },
        { montant_prevu: 3000, statut: 'paye' },
        { montant_prevu: 5000, statut: 'en_attente' },
      ],
      error: null,
    });
    mockChains['tresorerie_revenus'] = chain;

    const { calculateCAHT } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculateCAHT(new Date(2025, 5, 15));
    expect(result).toBe(11000);
    expect(chain.gte).toHaveBeenCalledWith('mois', '2025-06-01');
    expect(chain.lte).toHaveBeenCalledWith('mois', '2025-06-30');
  });

  it('should return 0 for CA HT on error', async () => {
    mockChains['tresorerie_revenus'] = createChain({
      data: null,
      error: { message: 'DB error' },
    });

    const { calculateCAHT } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculateCAHT(new Date('2025-06-15'));
    expect(result).toBe(0);
  });

  it('should include fixed expenses in calculateAllAutomaticExpenses', async () => {
    mockChains['rh_salaires_mensuels'] = createChain({
      data: [{ salaire_brut: 5000 }],
      error: null,
    });
    mockChains['tresorerie_revenus'] = createChain({
      data: [],
      error: null,
    });

    const { calculateAllAutomaticExpenses } = await import('../tresorerie/calculateAutomaticExpenses');
    const result = await calculateAllAutomaticExpenses(new Date('2025-06-15'));
    
    expect(result).toHaveProperty('DEP_GITHUB', 44);
    expect(result).toHaveProperty('DEP_SUPABASE', 25);
    expect(result).toHaveProperty('DEP_AZURE', 200);
    expect(result).toHaveProperty('DEP_NOTION', 80);
    expect(result).toHaveProperty('DEP_FIGMA', 45);
    expect(result).toHaveProperty('DEP_SALAIRES_NETS');
    expect(result).toHaveProperty('DEP_COTISATIONS');
    expect(result).toHaveProperty('DEP_URSSAF');
    expect(result).toHaveProperty('DEP_RETRAITE');
    expect(result).toHaveProperty('DEP_MUTUELLE');
    expect(result).toHaveProperty('DEP_PREVOYANCE');
    expect(result).toHaveProperty('DEP_TVA');
  });
});
