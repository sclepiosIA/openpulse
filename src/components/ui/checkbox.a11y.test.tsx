import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Checkbox } from './checkbox';
import { Label } from './label';

expect.extend({ toHaveNoViolations });

describe('Checkbox a11y', () => {
  it('checkbox with associated label has no a11y violations', async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Checkbox id="cgu" />
        <Label htmlFor="cgu">J'accepte les conditions</Label>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('checked checkbox has no a11y violations', async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Checkbox id="opt" defaultChecked />
        <Label htmlFor="opt">Recevoir les newsletters</Label>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
