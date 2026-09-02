import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useContext } from 'react';
import { RapportsDrilldownContext, RapportsDrilldownProvider } from '../RapportsDrilldownContext';

function TestConsumer() {
  const ctx = useContext(RapportsDrilldownContext);
  if (!ctx) return <div>No context</div>;
  return (
    <div>
      <span data-testid="levels">{ctx.breadcrumbs.length}</span>
      <span data-testid="label">{ctx.breadcrumbs[ctx.breadcrumbs.length - 1]?.label}</span>
      <button onClick={() => ctx.drillDown({ label: 'Détails', filters: { statut: 'actif' }, view: 'etablissements' as any })}>Drill</button>
      <button onClick={() => ctx.drillUp(0)}>Up</button>
      <button onClick={() => ctx.resetDrilldown()}>Reset</button>
      <button onClick={() => ctx.goToLevel(0)}>GoTo0</button>
    </div>
  );
}

describe('RapportsDrilldownContext', () => {
  it('starts with Dashboard breadcrumb', () => {
    render(
      <RapportsDrilldownProvider><TestConsumer /></RapportsDrilldownProvider>
    );
    expect(screen.getByTestId('levels').textContent).toBe('1');
    expect(screen.getByTestId('label').textContent).toBe('Dashboard');
  });

  it('drills down and up', () => {
    render(
      <RapportsDrilldownProvider><TestConsumer /></RapportsDrilldownProvider>
    );
    fireEvent.click(screen.getByText('Drill'));
    expect(screen.getByTestId('levels').textContent).toBe('2');
    expect(screen.getByTestId('label').textContent).toBe('Détails');
    
    fireEvent.click(screen.getByText('Up'));
    expect(screen.getByTestId('levels').textContent).toBe('1');
    expect(screen.getByTestId('label').textContent).toBe('Dashboard');
  });

  it('resets to initial state', () => {
    render(
      <RapportsDrilldownProvider><TestConsumer /></RapportsDrilldownProvider>
    );
    fireEvent.click(screen.getByText('Drill'));
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByTestId('levels').textContent).toBe('1');
  });

  it('goToLevel navigates correctly', () => {
    render(
      <RapportsDrilldownProvider><TestConsumer /></RapportsDrilldownProvider>
    );
    fireEvent.click(screen.getByText('Drill'));
    fireEvent.click(screen.getByText('GoTo0'));
    expect(screen.getByTestId('levels').textContent).toBe('1');
  });
});
