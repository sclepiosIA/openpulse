import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JarvisThinkingIndicator } from '../JarvisThinkingIndicator';

describe('JarvisThinkingIndicator', () => {
  it('renders initial thinking phrase', () => {
    render(<JarvisThinkingIndicator />);
    expect(screen.getByText('Analyse en cours')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<JarvisThinkingIndicator />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
