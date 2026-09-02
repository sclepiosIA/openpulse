import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));
vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn() },
}));
vi.mock('@/lib/frontendErrorCapture', () => ({
  frontendErrorCapture: { reportBoundaryError: vi.fn() },
}));

import { ErrorBoundary } from '../ErrorBoundary';

const ThrowingComponent = () => {
  throw new Error('Test error');
};

const GoodComponent = () => <div>Working fine</div>;

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Working fine')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
    expect(screen.getByText('Retour accueil')).toBeInTheDocument();
  });

  it('shows error details in technical section', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Détails techniques')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('reports error to frontendErrorCapture', async () => {
    const { frontendErrorCapture } = await import('@/lib/frontendErrorCapture');
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(frontendErrorCapture.reportBoundaryError).toHaveBeenCalled();
  });
});
