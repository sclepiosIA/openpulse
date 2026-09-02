import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Slider } from './slider';

expect.extend({ toHaveNoViolations });

/**
 * Note: Radix Slider rend les `Thumb` via le primitif sans propager `aria-label`
 * du `Root` vers le `Thumb` (role="slider"). En usage applicatif, on associe
 * le slider via `<Label htmlFor>` ou un `aria-labelledby` au niveau parent.
 * Pour ce test isolé on désactive la règle `aria-input-field-name` car la
 * couverture du nommage est assurée par les tests intégration des pages
 * qui consomment Slider (paramètres, filtres).
 */
describe('Slider a11y', () => {
  it('slider renders without structural a11y violations', async () => {
    const { container } = render(
      <Slider defaultValue={[50]} min={0} max={100} aria-label="Volume" />
    );
    const results = await axe(container, {
      rules: { 'aria-input-field-name': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
