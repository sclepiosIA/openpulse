import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Button } from './button';

expect.extend({ toHaveNoViolations });

describe('Card a11y', () => {
  it('card with header + content + footer has no a11y violations', async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Établissement</CardTitle>
          <CardDescription>EHPAD Les Lilas — Lyon</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Contenu de la carte.</p>
        </CardContent>
        <CardFooter>
          <Button>Voir le détail</Button>
        </CardFooter>
      </Card>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
