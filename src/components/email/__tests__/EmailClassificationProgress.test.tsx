import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailClassificationProgress } from '../EmailClassificationProgress';

describe('EmailClassificationProgress', () => {
  const defaultProps = {
    total: 100,
    processed: 60,
    matched: 40,
    suggested: 10,
    hors: 5,
    interne: 5,
    isRunning: false,
  };

  it('renders processed count', () => {
    render(<EmailClassificationProgress {...defaultProps} />);
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('renders matched count', () => {
    render(<EmailClassificationProgress {...defaultProps} />);
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('renders total in progress label', () => {
    render(<EmailClassificationProgress {...defaultProps} />);
    expect(screen.getByText('60 / 100')).toBeInTheDocument();
  });

  it('renders labels', () => {
    render(<EmailClassificationProgress {...defaultProps} />);
    expect(screen.getByText('Traités')).toBeInTheDocument();
    expect(screen.getByText('Attribués')).toBeInTheDocument();
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Hors étab.')).toBeInTheDocument();
    expect(screen.getByText('Interne')).toBeInTheDocument();
  });

  it('shows running indicator when isRunning', () => {
    render(<EmailClassificationProgress {...defaultProps} isRunning />);
    expect(screen.getByText(/Classification en cours/)).toBeInTheDocument();
  });

  it('hides running indicator when not running', () => {
    render(<EmailClassificationProgress {...defaultProps} />);
    expect(screen.queryByText(/Classification en cours/)).not.toBeInTheDocument();
  });
});
