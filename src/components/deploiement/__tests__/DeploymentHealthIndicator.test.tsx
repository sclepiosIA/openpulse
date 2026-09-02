import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DeploymentHealthIndicator } from '../DeploymentHealthIndicator';

describe('DeploymentHealthIndicator', () => {
  it('renders badge for healthy status', () => {
    const { container } = render(<DeploymentHealthIndicator status="healthy" score={90} />);
    expect(container.querySelector('.inline-flex')).toBeInTheDocument();
  });

  it('renders badge for at_risk status', () => {
    const { container } = render(<DeploymentHealthIndicator status="at-risk" score={50} />);
    expect(container.querySelector('.inline-flex')).toBeInTheDocument();
  });

  it('shows score when showScore is true', () => {
    const { container } = render(<DeploymentHealthIndicator status="healthy" score={85} showScore />);
    expect(container.textContent).toContain('85%');
  });

  it('renders tooltip with reasons when provided', () => {
    const { container } = render(
      <DeploymentHealthIndicator status="at-risk" score={20} reasons={['Retard tâches', 'Pas de contact']} />
    );
    expect(container.querySelector('.inline-flex')).toBeInTheDocument();
  });

  it('renders without tooltip when no reasons', () => {
    const { container } = render(<DeploymentHealthIndicator status="healthy" score={95} />);
    // No TooltipProvider wrapper when no reasons
    expect(container.querySelector('[data-state]')).toBeNull();
  });
});
