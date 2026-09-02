import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { ConfirmDialog } from '../confirm-dialog';

describe('ConfirmDialog a11y', () => {
  it('default — pas de violations a11y (titre + description Radix)', async () => {
    const { container } = render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Supprimer l'élément"
        description="Cette action est irréversible."
        onConfirm={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('destructive + loading — pas de violations a11y', async () => {
    const { container } = render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Supprimer"
        description="Confirmation requise."
        variant="destructive"
        loading
        onConfirm={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
