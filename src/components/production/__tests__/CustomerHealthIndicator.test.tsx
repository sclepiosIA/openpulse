import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CustomerHealthIndicator } from '../CustomerHealthIndicator';

describe('CustomerHealthIndicator', () => {
  it('renders badge for healthy status', () => {
    const { container } = render(<CustomerHealthIndicator status="healthy" />);
    expect(container.textContent).toContain('Bon');
  });

  it('renders badge for at-risk status', () => {
    const { container } = render(<CustomerHealthIndicator status="at-risk" />);
    expect(container.querySelector('.inline-flex')).toBeInTheDocument();
  });

  it('renders badge for critical status', () => {
    const { container } = render(<CustomerHealthIndicator status="critical" />);
    expect(container.textContent).toContain('Critical');
  });

  it('renders onboarding without tooltip', () => {
    const { container } = render(<CustomerHealthIndicator status="onboarding" />);
    expect(container.textContent).toContain('Onboarding');
  });

  it('shows score when showScore is true', () => {
    const { container } = render(<CustomerHealthIndicator status="healthy" score={85} showScore />);
    expect(container.textContent).toContain('85');
  });

  it('renders with healthData and factors', () => {
    const healthData = {
      status: 'healthy' as const,
      score: 90,
      factors: { adoption: 95, support: 80, payment: 100, engagement: 85, feedback: 90 },
      alerts: ['Low engagement'],
      trend: 'stable' as const,
    };
    const { container } = render(<CustomerHealthIndicator status="healthy" score={90} healthData={healthData} />);
    expect(container.textContent).toContain('Bon');
  });
});
