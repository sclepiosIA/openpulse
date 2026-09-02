import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EtablissementProvider, useEtablissementContext } from '../EtablissementContext';

function TestConsumer() {
  const { etablissement } = useEtablissementContext();
  return <span data-testid="nom">{etablissement?.nom || 'none'}</span>;
}

describe('EtablissementContext', () => {
  it('provides etablissement data', () => {
    render(
      <EtablissementProvider etablissement={{ id: 'e1', nom: 'CHU Test', slug: 'chu-test' } as any}>
        <TestConsumer />
      </EtablissementProvider>
    );
    expect(screen.getByTestId('nom').textContent).toBe('CHU Test');
  });

  it('provides null when no etablissement', () => {
    render(
      <EtablissementProvider etablissement={null}>
        <TestConsumer />
      </EtablissementProvider>
    );
    expect(screen.getByTestId('nom').textContent).toBe('none');
  });

  it('throws when used outside provider', () => {
    expect(() => render(<TestConsumer />)).toThrow('useEtablissementContext must be used within EtablissementProvider');
  });
});
