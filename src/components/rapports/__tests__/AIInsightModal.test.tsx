import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AIInsightModal } from '../AIInsightModal';

const insight = {
  type: 'trend' as const,
  title: 'Croissance du CA',
  description: 'Le chiffre d\'affaires a augmenté de 15% ce trimestre.',
  priority: 'high' as const,
  impact: 'positive' as const,
  actions: ['Renforcer l\'équipe commerciale', 'Lancer une campagne marketing'],
};

describe('AIInsightModal', () => {
  it('renders insight title when open', () => {
    render(<AIInsightModal open={true} onClose={vi.fn()} insight={insight} />);
    expect(screen.getByText('Croissance du CA')).toBeInTheDocument();
  });

  it('renders insight description', () => {
    render(<AIInsightModal open={true} onClose={vi.fn()} insight={insight} />);
    expect(screen.getByText(/augmenté de 15%/)).toBeInTheDocument();
  });

  it('renders actions', () => {
    render(<AIInsightModal open={true} onClose={vi.fn()} insight={insight} />);
    expect(screen.getByText('Renforcer l\'équipe commerciale')).toBeInTheDocument();
    expect(screen.getByText('Lancer une campagne marketing')).toBeInTheDocument();
  });

  it('renders type badge', () => {
    render(<AIInsightModal open={true} onClose={vi.fn()} insight={insight} />);
    expect(screen.getByText('Tendance')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<AIInsightModal open={false} onClose={vi.fn()} insight={insight} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
