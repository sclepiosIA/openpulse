import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AIProgressIndicator } from '@/components/email/AIProgressIndicator';

describe('AIProgressIndicator', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('should display reformulation title', () => {
    render(React.createElement(AIProgressIndicator, { operationType: 'reformulate' }));
    expect(screen.getByText('Reformulation en cours')).toBeInTheDocument();
  });

  it('should display translate title', () => {
    render(React.createElement(AIProgressIndicator, { operationType: 'translate' }));
    expect(screen.getByText('Traduction en cours')).toBeInTheDocument();
  });

  it('should display correct title', () => {
    render(React.createElement(AIProgressIndicator, { operationType: 'correct' }));
    expect(screen.getByText('Correction en cours')).toBeInTheDocument();
  });

  it('should display suggest title', () => {
    render(React.createElement(AIProgressIndicator, { operationType: 'suggest' }));
    expect(screen.getByText('Génération de suggestions')).toBeInTheDocument();
  });

  it('should display analyze title', () => {
    render(React.createElement(AIProgressIndicator, { operationType: 'analyze' }));
    expect(screen.getByText('Analyse IA en cours')).toBeInTheDocument();
  });

  it('should show elapsed time', () => {
    render(React.createElement(AIProgressIndicator, { operationType: 'reformulate' }));
    expect(screen.getByText(/Temps écoulé/)).toBeInTheDocument();
  });

  it('should show GPT-5 mention', () => {
    render(React.createElement(AIProgressIndicator, { operationType: 'reformulate' }));
    expect(screen.getByText(/GPT-5/)).toBeInTheDocument();
  });
});
