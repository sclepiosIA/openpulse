import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { PageDataState } from '../PageDataState';

describe('PageDataState a11y', () => {
  it('état loading — pas de violations a11y', async () => {
    const { container } = render(
      <MemoryRouter>
        <PageDataState isLoading isError={false}>
          <div>x</div>
        </PageDataState>
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('état empty — pas de violations a11y (titre/description + bouton)', async () => {
    const { container } = render(
      <MemoryRouter>
        <PageDataState
          isLoading={false}
          isError={false}
          isEmpty
          emptyTitle="Aucune donnée"
          emptyDescription="Rien à afficher pour le moment."
        >
          <div>x</div>
        </PageDataState>
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('état error — pas de violations a11y (bouton Réessayer)', async () => {
    const { container } = render(
      <MemoryRouter>
        <PageDataState
          isLoading={false}
          isError
          error={new Error('boom')}
          onRetry={vi.fn()}
        >
          <div>x</div>
        </PageDataState>
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
