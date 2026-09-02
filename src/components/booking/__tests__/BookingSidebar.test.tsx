import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BookingSidebar } from '../BookingSidebar';

describe('BookingSidebar', () => {
  it('renders with required props', () => {
    const { container } = render(
      <BookingSidebar
        pageTitle="Page de réservation"
        timezone="Europe/Paris"
        onTimezoneChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('displays page title', () => {
    const { getByText } = render(
      <BookingSidebar
        pageTitle="Consultation initiale"
        timezone="Europe/Paris"
        onTimezoneChange={vi.fn()}
      />
    );
    expect(getByText('Consultation initiale')).toBeInTheDocument();
  });
});
