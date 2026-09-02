import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';

expect.extend({ toHaveNoViolations });

describe('Popover a11y', () => {
  it('open popover has no a11y violations', async () => {
    const { baseElement } = render(
      <Popover open>
        <PopoverTrigger asChild>
          <Button>Ouvrir</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Détails utilisateur">
          <p>Contenu du popover</p>
        </PopoverContent>
      </Popover>
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
