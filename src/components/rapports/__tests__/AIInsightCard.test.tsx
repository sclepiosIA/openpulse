import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIInsightCard } from '../AIInsightCard';

describe('AIInsightCard', () => {
  const defaultProps = {
    type: 'trend' as const,
    title: 'Hausse du CA',
    description: 'Le CA a augmenté de 15% ce mois.',
    insightId: 'i1',
  };

  it('renders title and description', () => {
    render(<AIInsightCard {...defaultProps} />);
    expect(screen.getByText('Hausse du CA')).toBeInTheDocument();
    expect(screen.getByText('Le CA a augmenté de 15% ce mois.')).toBeInTheDocument();
  });

  it('renders type badge', () => {
    render(<AIInsightCard {...defaultProps} />);
    expect(screen.getByText('Tendance')).toBeInTheDocument();
  });

  it('renders priority badge when provided', () => {
    render(<AIInsightCard {...defaultProps} priority="high" />);
    expect(screen.getByText('Élevé')).toBeInTheDocument();
  });

  it('renders impact label when provided', () => {
    render(<AIInsightCard {...defaultProps} impact="positive" />);
    expect(screen.getByText('↑ Positif')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(<AIInsightCard {...defaultProps} actions={['Contacter le client', 'Planifier un RDV']} />);
    expect(screen.getByText('Contacter le client')).toBeInTheDocument();
    expect(screen.getByText('Planifier un RDV')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss clicked', () => {
    const onDismiss = vi.fn();
    render(<AIInsightCard {...defaultProps} onDismiss={onDismiss} />);
    const dismissBtn = screen.getByTitle('Ne plus afficher cet insight');
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledWith('i1');
  });

  it('renders detail button', () => {
    render(<AIInsightCard {...defaultProps} />);
    expect(screen.getByText('Voir le détail complet')).toBeInTheDocument();
  });

  it('renders alert type correctly', () => {
    render(<AIInsightCard {...defaultProps} type="alert" />);
    expect(screen.getByText('Alerte')).toBeInTheDocument();
  });

  it('renders recommendation type correctly', () => {
    render(<AIInsightCard {...defaultProps} type="recommendation" />);
    expect(screen.getByText('Recommandation')).toBeInTheDocument();
  });

  it('renders anomaly type correctly', () => {
    render(<AIInsightCard {...defaultProps} type="anomaly" />);
    expect(screen.getByText('Anomalie')).toBeInTheDocument();
  });
});
