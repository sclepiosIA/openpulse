import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityFeed } from '../ActivityFeed';

vi.mock('@/hooks/activity/useActivityFeed', () => ({
  useActivityFeed: () => ({
    myActivity: [],
    requiredActions: [],
    teamActivity: [],
    isLoading: false,
  }),
}));

describe('ActivityFeed', () => {
  it('renders activity feed card title', () => {
    render(<ActivityFeed />);
    expect(screen.getByText('Mon Activité Récente & Actions Requises')).toBeInTheDocument();
  });

  it('renders 3 tabs', () => {
    render(<ActivityFeed />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);
  });

  it('shows empty state when no activities', () => {
    render(<ActivityFeed />);
    expect(screen.getByText('Aucune activité récente')).toBeInTheDocument();
  });
});
