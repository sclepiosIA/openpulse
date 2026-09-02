import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClickableLocation } from '@/components/calendrier/ClickableLocation';

vi.mock('@/hooks/meeting/useVisioDetection', () => ({
  detectVisioLink: (location: string) => {
    if (location.includes('meet.google.com')) {
      return { provider: 'google_meet', url: location };
    }
    if (location.includes('teams.microsoft.com')) {
      return { provider: 'teams', url: location };
    }
    if (location.includes('zoom.us')) {
      return { provider: 'zoom', url: location };
    }
    return null;
  },
}));

describe('ClickableLocation', () => {
  it('should render regular location as text', () => {
    render(<ClickableLocation location="Salle A, Bâtiment 1" />);
    expect(screen.getByText('Salle A, Bâtiment 1')).toBeInTheDocument();
  });

  it('should not be a link for regular location', () => {
    render(<ClickableLocation location="Bureau 203" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should render Google Meet as clickable link', () => {
    render(<ClickableLocation location="https://meet.google.com/abc-defg-hij" />);
    expect(screen.getByText('Google Meet')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should render Teams as clickable link', () => {
    render(<ClickableLocation location="https://teams.microsoft.com/l/meetup-join/123" />);
    expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
  });

  it('should render Zoom as clickable link', () => {
    render(<ClickableLocation location="https://zoom.us/j/123456" />);
    expect(screen.getByText('Zoom')).toBeInTheDocument();
  });

  it('should render generic URL with domain', () => {
    render(<ClickableLocation location="https://example.com/room/123" />);
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('should hide icon when showIcon is false', () => {
    const { container } = render(<ClickableLocation location="Bureau" showIcon={false} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
