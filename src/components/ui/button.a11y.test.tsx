import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Button } from './button';
import { Save, X, Trash2 } from 'lucide-react';

expect.extend({ toHaveNoViolations });

describe('Button a11y', () => {
  it('text button has no a11y violations', async () => {
    const { container } = render(<Button>Enregistrer</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('icon-only button with aria-label has no a11y violations', async () => {
    const { container } = render(
      <Button variant="ghost" size="icon" aria-label="Fermer">
        <X />
      </Button>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('icon + visible text has no a11y violations', async () => {
    const { container } = render(
      <Button>
        <Save />
        <span>Sauvegarder</span>
      </Button>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('destructive variant disabled has no a11y violations', async () => {
    const { container } = render(
      <Button variant="destructive" disabled aria-label="Supprimer">
        <Trash2 />
      </Button>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
