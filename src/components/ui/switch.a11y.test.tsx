import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Switch } from './switch';
import { Label } from './label';

expect.extend({ toHaveNoViolations });

describe('Switch a11y', () => {
  it('switch with associated label has no a11y violations', async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Switch id="notif" />
        <Label htmlFor="notif">Activer les notifications</Label>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('switch with aria-label only has no a11y violations', async () => {
    const { container } = render(<Switch aria-label="Mode sombre" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
