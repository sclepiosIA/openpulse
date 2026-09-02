import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PulseMarkdownRenderer } from '../PulseMarkdownRenderer';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('PulseMarkdownRenderer', () => {
  it('renders plain text', () => {
    wrap(<PulseMarkdownRenderer content="Bonjour le monde" />);
    expect(screen.getByText('Bonjour le monde')).toBeInTheDocument();
  });

  it('renders bold markdown', () => {
    wrap(<PulseMarkdownRenderer content="**Important**" />);
    expect(screen.getByText('Important')).toBeInTheDocument();
  });

  it('renders list items', () => {
    wrap(<PulseMarkdownRenderer content={"- Item 1\n- Item 2"} />);
    expect(screen.getByText(/Item 1/)).toBeInTheDocument();
  });

  it('renders with entity links', () => {
    wrap(
      <PulseMarkdownRenderer
        content="Voir cet établissement"
        entityLinks={[{ type: 'etablissement', id: 'e1', name: 'CHU Test' }]}
      />
    );
    expect(screen.getByText('Voir cet établissement')).toBeInTheDocument();
  });
});
