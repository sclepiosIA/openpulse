import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { ContactForm } from '../ContactForm';

describe('ContactForm — a11y (axe-core)', () => {
  it("aucune violation a11y en mode création", async () => {
    const { container } = render(
      <ContactForm
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
