import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MobileCompactToggle } from '@/components/dashboard/MobileCompactToggle';
import type { MobileDashboardMode } from '@/hooks/analytics/useMobileDashboard';

describe('MobileCompactToggle', () => {
  it('should render toggle button in carousel mode', () => {
    const { container } = render(
      React.createElement(MobileCompactToggle, {
        mode: 'carousel' as MobileDashboardMode,
        onToggle: vi.fn(),
      })
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should call onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(
      React.createElement(MobileCompactToggle, {
        mode: 'carousel' as MobileDashboardMode,
        onToggle,
      })
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('should indicate compact mode', () => {
    const { container } = render(
      React.createElement(MobileCompactToggle, {
        mode: 'compact' as MobileDashboardMode,
        onToggle: vi.fn(),
      })
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
