import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Input } from './input';
import { Label } from './label';

expect.extend({ toHaveNoViolations });

describe('Input a11y', () => {
  it('input with associated label has no a11y violations', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="email">Adresse email</Label>
        <Input id="email" type="email" />
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('input with aria-label has no a11y violations', async () => {
    const { container } = render(<Input aria-label="Rechercher" type="search" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('disabled input has no a11y violations', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="x">Champ verrouillé</Label>
        <Input id="x" disabled />
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('required input with aria-describedby has no a11y violations', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="pwd">Mot de passe</Label>
        <Input id="pwd" type="password" required aria-describedby="pwd-help" />
        <p id="pwd-help">Minimum 12 caractères.</p>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
