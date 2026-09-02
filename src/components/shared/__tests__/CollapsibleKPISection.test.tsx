import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleKPISection, KPIToggleButton } from '../CollapsibleKPISection';

describe('CollapsibleKPISection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders children', () => {
    render(
      <CollapsibleKPISection storageKey="test-kpi" defaultOpen={true}>
        <div>KPI Content</div>
      </CollapsibleKPISection>
    );
    expect(screen.getByText('KPI Content')).toBeInTheDocument();
  });

  it('respects defaultOpen=false', () => {
    const { container } = render(
      <CollapsibleKPISection storageKey="test-kpi-closed" defaultOpen={false}>
        <div>Hidden Content</div>
      </CollapsibleKPISection>
    );
    // Content is in collapsed state
    expect(container.querySelector('[data-state="closed"]')).toBeTruthy();
  });

  it('reads initial state from localStorage', () => {
    localStorage.setItem('test-stored', 'true');
    render(
      <CollapsibleKPISection storageKey="test-stored">
        <div>Stored Content</div>
      </CollapsibleKPISection>
    );
    expect(screen.getByText('Stored Content')).toBeInTheDocument();
  });
});

describe('KPIToggleButton', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders toggle button', () => {
    render(<KPIToggleButton storageKey="test-toggle" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<KPIToggleButton storageKey="test-toggle" label="Indicateurs" />);
    expect(screen.getByText('Indicateurs')).toBeInTheDocument();
  });

  it('toggles state on click and saves to localStorage', () => {
    render(<KPIToggleButton storageKey="test-toggle-click" />);
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('test-toggle-click')).toBe('true');
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('test-toggle-click')).toBe('false');
  });

  it('calls onToggle callback', () => {
    const onToggle = vi.fn();
    render(<KPIToggleButton storageKey="test-cb" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
