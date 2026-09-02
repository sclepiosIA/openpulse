import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPIToggleButton } from './CollapsibleKPISection';

/**
 * Test ciblé — accessibilité du bouton KPIs utilisé sur /support
 * (et autres pages). Sur mobile le label textuel est masqué (`hidden sm:inline`),
 * donc l'accessibilité repose sur `aria-label`.
 */
describe('KPIToggleButton — accessible name', () => {
  it('exposes an aria-label even when the visible label is hidden on mobile', () => {
    render(<KPIToggleButton storageKey="test-a11y-kpi" label="KPIs" />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toMatch(/KPIs/i);
  });

  it('falls back to a default aria-label when no label prop is provided', () => {
    render(<KPIToggleButton storageKey="test-a11y-kpi-2" />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toMatch(/KPIs/i);
  });

  it('reflects open state via aria-expanded', () => {
    render(<KPIToggleButton storageKey="test-a11y-kpi-3" label="KPIs" />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });
});
