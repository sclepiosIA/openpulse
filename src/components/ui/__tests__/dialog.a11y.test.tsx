import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../dialog';
import { Button } from '../button';
import { Input } from '../input';
import { Label } from '../label';

describe('Dialog a11y (form standard)', () => {
  it('formulaire dans Dialog — pas de violations a11y', async () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau contact</DialogTitle>
            <DialogDescription>Renseignez les informations du contact.</DialogDescription>
          </DialogHeader>
          <form>
            <div>
              <Label htmlFor="contact-nom">Nom</Label>
              <Input id="contact-nom" name="nom" />
            </div>
            <div>
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" name="email" type="email" />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline">Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
