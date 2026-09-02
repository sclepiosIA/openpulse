import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Label } from './label';

expect.extend({ toHaveNoViolations });

describe('Select a11y', () => {
  it('select with associated label has no a11y violations', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="role">Rôle</Label>
        <Select>
          <SelectTrigger id="role" aria-label="Rôle">
            <SelectValue placeholder="Choisir un rôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrateur</SelectItem>
            <SelectItem value="user">Utilisateur</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
