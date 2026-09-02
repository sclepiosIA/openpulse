import { render, screen } from '@testing-library/react';
import { ScoringKpiBar } from './ScoringKpiBar';
import type { ScoringOverviewKpis } from '@/hooks/crm/useBehavioralScore';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div data-testid="kpi-card">{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="kpi-skeleton" />,
}));

const norm = (s: string | null) => (s ?? '').replace(/[\u202f\u00a0]/g, ' ');

const KPIS: ScoringOverviewKpis = {
  total: 1234,
  hot: 80,
  warm: 45,
  cold: 12,
  weighted_mrr_potential: 5000,
} as ScoringOverviewKpis;

describe('ScoringKpiBar', () => {
  it('affiche 5 cartes avec les labels attendus', () => {
    render(<ScoringKpiBar kpis={KPIS} />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(5);
    expect(screen.getByText('Total prospects')).toBeTruthy();
    expect(screen.getByText('🔥 Chauds (≥80)')).toBeTruthy();
    expect(screen.getByText('🌡️ Tièdes (60-79)')).toBeTruthy();
    expect(screen.getByText('❄️ Froids (<40)')).toBeTruthy();
    expect(screen.getByText('💰 MRR pondéré')).toBeTruthy();
  });

  it('affiche des skeletons à la place des valeurs en mode loading', () => {
    const { container } = render(<ScoringKpiBar kpis={KPIS} loading />);
    expect(screen.getAllByTestId('kpi-skeleton')).toHaveLength(5);
    expect(norm(container.textContent)).not.toContain('1 234');
    expect(screen.getByText('Total prospects')).toBeTruthy();
  });

  it('formate les valeurs en fr-FR et le MRR en euros', () => {
    const { container } = render(<ScoringKpiBar kpis={KPIS} />);
    const text = norm(container.textContent);
    expect(text).toContain('1 234');
    expect(text).toContain('5 000 €');
    expect(text).toContain('80');
    expect(text).toContain('45');
    expect(text).toContain('12');
    expect(screen.queryByTestId('kpi-skeleton')).toBeNull();
  });

  it('affiche les deltas positifs, nuls et négatifs avec pourcentage', () => {
    const { container } = render(
      <ScoringKpiBar
        kpis={KPIS}
        prev={{ total: 1000, hot: 80, cold: 20 }}
      />
    );
    const text = norm(container.textContent);
    // total: 1234 - 1000 = +234, 234/1000 = 23.4 → 23%
    expect(text).toContain('+234 (+23%)');
    // hot: 80 - 80 = 0 → badge neutre "0"
    // cold: 12 - 20 = -8, -8/20 = -40%
    expect(text).toContain('-8 (-40%)');
  });

  it('affiche un badge neutre quand le delta est nul', () => {
    const { container } = render(<ScoringKpiBar kpis={KPIS} prev={{ hot: 80 }} />);
    const badge = container.querySelector('.text-muted-foreground.inline-flex, span.inline-flex.text-xs.text-muted-foreground');
    const neutral = Array.from(container.querySelectorAll('span')).find(
      (el) => el.className.includes('text-muted-foreground') && norm(el.textContent) === '0'
    );
    expect(neutral).toBeTruthy();
    expect(badge ?? neutral).toBeTruthy();
  });

  it('affiche 0 partout et aucun badge delta sans kpis ni prev', () => {
    const { container } = render(<ScoringKpiBar />);
    const text = norm(container.textContent);
    expect(text).toContain('0 €');
    const zeroValues = screen.getAllByText('0');
    expect(zeroValues.length).toBeGreaterThanOrEqual(4);
    expect(text).not.toContain('%');
    expect(container.querySelectorAll('[data-testid="kpi-card"]')).toHaveLength(5);
  });

  it("n'affiche pas de badge pour une carte dont prev est absent (MRR pondéré)", () => {
    const { container } = render(
      <ScoringKpiBar kpis={KPIS} prev={{ total: 1000 }} />
    );
    const text = norm(container.textContent);
    expect(text).toContain('+234 (+23%)');
    // une seule carte a un prev défini → un seul badge delta
    const badges = Array.from(container.querySelectorAll('span')).filter((el) =>
      el.className.includes('inline-flex') && el.className.includes('text-xs')
    );
    expect(badges).toHaveLength(1);
  });
});