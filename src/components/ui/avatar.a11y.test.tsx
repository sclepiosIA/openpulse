import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

expect.extend({ toHaveNoViolations });

describe('Avatar a11y', () => {
  it('avatar with image alt + fallback has no a11y violations', async () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="/u.jpg" alt="Marie Dupont" />
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('avatar fallback only (no image) has no a11y violations', async () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
