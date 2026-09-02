import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostBadges } from '../PostBadges';

describe('PostBadges', () => {
  const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
  const oldDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago

  it('renders "Nouveau" badge for recent post', () => {
    render(<PostBadges createdAt={recentDate} upvotes={0} commentsCount={0} views={0} />);
    expect(screen.getByText('Nouveau')).toBeInTheDocument();
  });

  it('does not render "Nouveau" for old post', () => {
    render(<PostBadges createdAt={oldDate} upvotes={0} commentsCount={0} views={0} />);
    expect(screen.queryByText('Nouveau')).not.toBeInTheDocument();
  });

  it('renders "Hot" badge for high engagement recent post', () => {
    render(<PostBadges createdAt={recentDate} upvotes={20} commentsCount={10} views={100} />);
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });

  it('renders "Tendance" badge for trending post', () => {
    render(<PostBadges createdAt={recentDate} upvotes={15} commentsCount={0} views={0} />);
    expect(screen.getByText('Tendance')).toBeInTheDocument();
  });

  it('renders nothing for old post with no engagement', () => {
    const { container } = render(<PostBadges createdAt={oldDate} upvotes={0} commentsCount={0} views={0} />);
    expect(container.innerHTML).toBe('');
  });
});
