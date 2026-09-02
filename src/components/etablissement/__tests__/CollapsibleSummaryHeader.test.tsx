import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollapsibleSummaryHeader } from '../CollapsibleSummaryHeader';

describe('CollapsibleSummaryHeader', () => {
  const defaultProps = {
    etablissementId: 'e1',
    etablissementNom: 'CHU Lyon',
    statut: 'Production',
    progression: 85,
    tasksCompleted: 17,
    tasksTotal: 20,
  };

  it('renders etablissement name', () => {
    render(
      <CollapsibleSummaryHeader {...defaultProps}>
        <div>Children content</div>
      </CollapsibleSummaryHeader>
    );
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(
      <CollapsibleSummaryHeader {...defaultProps}>
        <div>Children</div>
      </CollapsibleSummaryHeader>
    );
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders task count', () => {
    render(
      <CollapsibleSummaryHeader {...defaultProps}>
        <div>Children</div>
      </CollapsibleSummaryHeader>
    );
    expect(screen.getByText(/17/)).toBeInTheDocument();
    expect(screen.getByText(/20/)).toBeInTheDocument();
  });

  it('renders progression percentage', () => {
    render(
      <CollapsibleSummaryHeader {...defaultProps}>
        <div>Children</div>
      </CollapsibleSummaryHeader>
    );
    expect(screen.getAllByText(/85/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders collapsible trigger button', () => {
    render(
      <CollapsibleSummaryHeader {...defaultProps}>
        <div>Expanded content</div>
      </CollapsibleSummaryHeader>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
