import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PulseWidgetMessagePreview } from '../PulseWidgetMessagePreview';

describe('PulseWidgetMessagePreview', () => {
  it('renders plain text content', () => {
    render(<PulseWidgetMessagePreview content="Bonjour tout le monde" />);
    expect(screen.getByText('Bonjour tout le monde')).toBeInTheDocument();
  });

  it('handles long content', () => {
    const longText = 'A'.repeat(300);
    const { container } = render(<PulseWidgetMessagePreview content={longText} maxLength={100} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('parses entity links into chips', () => {
    const content = 'Voir #[CHU Lyon](etablissement:123) pour détails';
    render(<PulseWidgetMessagePreview content={content} />);
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
  });

  it('renders multiple entity types', () => {
    const content = '#[Dr Dupont](contact:c1) a contacté #[GHT Nord](groupe:g1)';
    render(<PulseWidgetMessagePreview content={content} />);
    expect(screen.getByText('Dr Dupont')).toBeInTheDocument();
    expect(screen.getByText('GHT Nord')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<PulseWidgetMessagePreview content="test" className="my-class" />);
    expect(container.querySelector('.my-class')).toBeInTheDocument();
  });
});
