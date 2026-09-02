import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { EmptyState } from './EmptyState';

expect.extend({ toHaveNoViolations });

describe('EmptyState a11y', () => {
  it('default (empty) variant has no a11y violations', async () => {
    const { container } = render(<EmptyState type="empty" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('no-results variant has no a11y violations', async () => {
    const { container } = render(<EmptyState type="no-results" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('error variant with action button has no a11y violations', async () => {
    const { container } = render(
      <EmptyState
        type="error"
        title="Erreur"
        description="Une erreur est survenue"
        action={{ label: 'Réessayer', onClick: () => {} }}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('with secondary action has no a11y violations', async () => {
    const { container } = render(
      <EmptyState
        type="not-configured"
        action={{ label: 'Configurer', onClick: () => {} }}
        secondaryAction={{ label: 'Aide', onClick: () => {} }}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
