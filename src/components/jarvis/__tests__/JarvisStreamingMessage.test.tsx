import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { JarvisStreamingMessage } from '../JarvisStreamingMessage';

describe('JarvisStreamingMessage', () => {
  it('renders streaming content', () => {
    render(<JarvisStreamingMessage content="Analyse en cours..." isStreaming={true} />);
    expect(screen.getByText(/Analyse en cours/)).toBeInTheDocument();
  });

  it('renders complete state', () => {
    render(<JarvisStreamingMessage content="Voici le résultat." isStreaming={false} />);
    expect(screen.getByText(/Voici le résultat/)).toBeInTheDocument();
  });
});
