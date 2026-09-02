import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailClassificationChart } from '../EmailClassificationChart';

const defaultProps = {
  autoMatchedCount: 50,
  manuallyClassifiedCount: 20,
  unclassifiedCount: 30,
  totalThreadsCount: 100,
  autoMatchRate: 50,
  totalClassificationRate: 70,
  totalClassifiedCount: 70,
  horsEtablissementCount: 10,
  etablissementCount: 40,
  partenaireCount: 15,
  groupeCount: 5,
  interneCount: 0,
};

describe('EmailClassificationChart', () => {
  it('renders classification rate card', () => {
    render(<EmailClassificationChart {...defaultProps} />);
    expect(screen.getByText('Taux de classification total')).toBeInTheDocument();
  });

  it('renders classification percentage', () => {
    render(<EmailClassificationChart {...defaultProps} />);
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('renders category breakdown', () => {
    render(<EmailClassificationChart {...defaultProps} />);
    expect(screen.getByText('Établissements')).toBeInTheDocument();
    expect(screen.getByText('Partenaires')).toBeInTheDocument();
  });

  it('shows unclassified count', () => {
    render(<EmailClassificationChart {...defaultProps} />);
    expect(screen.getByText(/Non classé/i)).toBeInTheDocument();
  });
});
