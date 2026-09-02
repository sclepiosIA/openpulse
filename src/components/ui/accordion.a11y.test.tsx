import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';

expect.extend({ toHaveNoViolations });

describe('Accordion a11y', () => {
  it('multi-item accordion has no a11y violations', async () => {
    const { container } = render(
      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>Section A</AccordionTrigger>
          <AccordionContent>Contenu A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Section B</AccordionTrigger>
          <AccordionContent>Contenu B</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
