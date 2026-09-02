import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DashboardErrorBoundary } from '../DashboardErrorBoundary';

vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn() } }));

function ThrowingChild(): React.ReactNode {
  throw new Error('Test crash');
}

describe('DashboardErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <DashboardErrorBoundary componentName="TestWidget">
        <span>OK</span>
      </DashboardErrorBoundary>
    );
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('renders error fallback on crash', () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <DashboardErrorBoundary componentName="MonWidget">
        <ThrowingChild />
      </DashboardErrorBoundary>
    );
    expect(screen.getByText('Erreur dans MonWidget')).toBeInTheDocument();
    expect(screen.getByText('Test crash')).toBeInTheDocument();
    spy.mockRestore();
  });
});
