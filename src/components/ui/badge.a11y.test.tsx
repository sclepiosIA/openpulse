import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Badge } from './badge';

expect.extend({ toHaveNoViolations });

describe('Badge a11y', () => {
  it('badge variants have no a11y violations', async () => {
    const { container } = render(
      <div className="flex gap-2">
        <Badge>Défaut</Badge>
        <Badge variant="secondary">Secondaire</Badge>
        <Badge variant="destructive">Destructif</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
