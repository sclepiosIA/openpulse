import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DataCompletionGuide } from '../DataCompletionGuide';

describe('DataCompletionGuide', () => {
  it('renders guide title', () => {
    render(<DataCompletionGuide />);
    expect(screen.getByText('Guide de saisie des métriques réelles')).toBeInTheDocument();
  });

  it('renders NPS section', () => {
    render(<DataCompletionGuide />);
    expect(screen.getByText(/NPS Score/)).toBeInTheDocument();
  });

  it('renders adoption section', () => {
    render(<DataCompletionGuide />);
    expect(screen.getByText(/Adoption/)).toBeInTheDocument();
  });
});
