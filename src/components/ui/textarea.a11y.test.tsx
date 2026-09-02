import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Textarea } from './textarea';
import { Label } from './label';

expect.extend({ toHaveNoViolations });

describe('Textarea a11y', () => {
  it('textarea with associated label has no a11y violations', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="msg">Votre message</Label>
        <Textarea id="msg" rows={5} />
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('textarea with aria-describedby has no a11y violations', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" aria-describedby="bio-help" maxLength={280} />
        <p id="bio-help">Max 280 caractères.</p>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
