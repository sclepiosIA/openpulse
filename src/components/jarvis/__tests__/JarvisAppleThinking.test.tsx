import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JarvisAppleThinking } from '../JarvisAppleThinking';

describe('JarvisAppleThinking', () => {
  it('renders initial thinking state', () => {
    render(<JarvisAppleThinking />);
    expect(screen.getByText('Analyse en cours')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<JarvisAppleThinking className="test" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
