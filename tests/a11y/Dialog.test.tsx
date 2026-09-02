import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

expect.extend({ toHaveNoViolations });

describe('Dialog Accessibility', () => {
  it('dialog fermé — pas de violation sur le trigger', async () => {
    const { container } = render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Ouvrir</Button>
        </DialogTrigger>
      </Dialog>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('dialog ouvert avec title + description — pas de violation', async () => {
    const { container } = render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmation</DialogTitle>
            <DialogDescription>
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <Button>Confirmer</Button>
        </DialogContent>
      </Dialog>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
