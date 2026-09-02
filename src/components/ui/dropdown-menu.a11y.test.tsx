import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

expect.extend({ toHaveNoViolations });

describe('DropdownMenu a11y', () => {
  it('open dropdown menu has no a11y violations', async () => {
    const { baseElement } = render(
      <main>
        <DropdownMenu open>
          <DropdownMenuTrigger asChild>
            <Button>Actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profil</DropdownMenuItem>
            <DropdownMenuItem>Paramètres</DropdownMenuItem>
            <DropdownMenuItem>Déconnexion</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </main>
    );
    // Le portail Radix sort du landmark <main> en test isolé.
    // En usage applicatif, l'app entière est dans un landmark.
    const results = await axe(baseElement, {
      rules: { region: { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
