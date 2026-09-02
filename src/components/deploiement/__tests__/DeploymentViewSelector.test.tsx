import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeploymentViewSelector } from '../DeploymentViewSelector';

describe('DeploymentViewSelector', () => {
  it('renders 3 view tabs (desktop)', () => {
    const { container } = render(<DeploymentViewSelector currentView="list" onViewChange={vi.fn()} />);
    const triggers = container.querySelectorAll('[role="tab"]');
    expect(triggers.length).toBe(3);
  });

  it('renders all view labels', () => {
    render(<DeploymentViewSelector currentView="list" onViewChange={vi.fn()} />);
    expect(screen.getAllByText('Liste').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Chronologie').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Gantt').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Vue label', () => {
    render(<DeploymentViewSelector currentView="list" onViewChange={vi.fn()} />);
    expect(screen.getByText('Vue:')).toBeInTheDocument();
  });

  it('has active tab matching currentView', () => {
    const { container } = render(<DeploymentViewSelector currentView="gantt" onViewChange={vi.fn()} />);
    const activeTab = container.querySelector('[data-state="active"]');
    expect(activeTab).toBeTruthy();
    expect(activeTab?.textContent).toContain('Gantt');
  });
});
