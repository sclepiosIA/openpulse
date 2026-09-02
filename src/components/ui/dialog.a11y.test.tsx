import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';

expect.extend({ toHaveNoViolations });

describe('Dialog a11y', () => {
  it('open dialog with title + description has no a11y violations', async () => {
    const { baseElement } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'action</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Souhaitez-vous continuer ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline">Annuler</Button>
            <Button>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    const results = await axe(baseElement);
    expect(results).toHaveNoViolations();
  });

  it('dialog with form content has no a11y violations', async () => {
    const { baseElement } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle entrée</DialogTitle>
          </DialogHeader>
          <form>
            <label htmlFor="name">Nom</label>
            <input id="name" type="text" />
          </form>
        </DialogContent>
      </Dialog>
    );
    const results = await axe(baseElement);
    expect(results).toHaveNoViolations();
  });
});
