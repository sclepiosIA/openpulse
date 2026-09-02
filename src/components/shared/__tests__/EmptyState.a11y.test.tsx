import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { EmptyState } from '../EmptyState';

describe('EmptyState a11y', () => {
  it.each(['no-results', 'empty', 'not-configured', 'error'] as const)(
    'type %s — pas de violations a11y',
    async (type) => {
      const { container } = render(
        <EmptyState
          type={type}
          action={{ label: 'Action', onClick: vi.fn() }}
          secondaryAction={{ label: 'Autre', onClick: vi.fn() }}
        />,
      );
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    },
  );
});
