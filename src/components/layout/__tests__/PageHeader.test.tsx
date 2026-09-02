import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Mon titre" />);
    expect(screen.getByText('Mon titre')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(<PageHeader title="Test" actions={<button>Action</button>} />);
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('does not render actions wrapper when no actions', () => {
    const { container } = render(<PageHeader title="Test" />);
    // Only the title should be present, no actions wrapper
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('renders title as h1', () => {
    render(<PageHeader title="Heading" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading');
  });
});
