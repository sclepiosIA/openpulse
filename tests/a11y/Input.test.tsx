import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

expect.extend({ toHaveNoViolations });

describe('Input Accessibility', () => {
  it('input avec label associé — pas de violation', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" />
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('input avec aria-label seul — pas de violation', async () => {
    const { container } = render(
      <Input aria-label="Recherche" type="search" placeholder="Rechercher…" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('input désactivé — pas de violation', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="disabled-field">Champ verrouillé</Label>
        <Input id="disabled-field" disabled value="lecture seule" readOnly />
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
