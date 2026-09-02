import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../sheet';

describe('Sheet a11y (mobile navigation drawer)', () => {
  it('Sheet latéral mobile — pas de violations a11y', async () => {
    const { container } = render(
      <Sheet open>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Menu principal de l'application.</SheetDescription>
          </SheetHeader>
          <nav aria-label="Navigation principale mobile">
            <ul>
              <li><a href="/">Accueil</a></li>
              <li><a href="/etablissements">Établissements</a></li>
              <li><a href="/emails">Emails</a></li>
              <li><a href="/people">People</a></li>
            </ul>
          </nav>
        </SheetContent>
      </Sheet>,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
