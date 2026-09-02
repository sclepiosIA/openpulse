import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Label } from './label';

expect.extend({ toHaveNoViolations });

describe('RadioGroup a11y', () => {
  it('radio group with labels has no a11y violations', async () => {
    const { container } = render(
      <RadioGroup defaultValue="email" aria-label="Canal de notification">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="email" id="r-email" />
          <Label htmlFor="r-email">Email</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="sms" id="r-sms" />
          <Label htmlFor="r-sms">SMS</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="push" id="r-push" />
          <Label htmlFor="r-push">Push</Label>
        </div>
      </RadioGroup>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
