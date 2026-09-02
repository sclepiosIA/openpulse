import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PageDataState } from './PageDataState';

expect.extend({ toHaveNoViolations });

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('PageDataState a11y', () => {
  it('loading state has no a11y violations', async () => {
    const { container } = wrap(
      <PageDataState isLoading isError={false}>
        <div>content</div>
      </PageDataState>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('error state with retry has no a11y violations', async () => {
    const { container } = wrap(
      <PageDataState
        isLoading={false}
        isError
        error={new Error('Network down')}
        onRetry={() => {}}
      >
        <div>content</div>
      </PageDataState>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('empty state has no a11y violations', async () => {
    const { container } = wrap(
      <PageDataState isLoading={false} isError={false} isEmpty>
        <div>content</div>
      </PageDataState>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('ok state passes children through cleanly', async () => {
    const { container } = wrap(
      <PageDataState isLoading={false} isError={false} isEmpty={false}>
        <main>
          <h1>Page principale</h1>
          <p>Contenu</p>
        </main>
      </PageDataState>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
