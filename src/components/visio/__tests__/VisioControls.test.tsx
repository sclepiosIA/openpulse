import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisioControls } from '../VisioControls';
import { TooltipProvider } from '@/components/ui/tooltip';

const defaultMedia = {
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
};

const wrap = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe('VisioControls', () => {
  const baseProps = {
    mediaState: defaultMedia,
    participantCount: 3,
    onToggleMute: vi.fn(),
    onToggleVideo: vi.fn(),
    onToggleScreenShare: vi.fn(),
    onLeave: vi.fn(),
  };

  it('renders mute, video, screen share and leave buttons', () => {
    const { container } = wrap(<VisioControls {...baseProps} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('calls onToggleMute when mute button clicked', () => {
    const onMute = vi.fn();
    const { container } = wrap(<VisioControls {...baseProps} onToggleMute={onMute} />);
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[0]); // first button is mute
    expect(onMute).toHaveBeenCalled();
  });

  it('calls onToggleVideo when video button clicked', () => {
    const onVideo = vi.fn();
    const { container } = wrap(<VisioControls {...baseProps} onToggleVideo={onVideo} />);
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[1]); // second button is video
    expect(onVideo).toHaveBeenCalled();
  });

  it('calls onLeave when leave button clicked', () => {
    const onLeave = vi.fn();
    const { container } = wrap(<VisioControls {...baseProps} onLeave={onLeave} />);
    const buttons = container.querySelectorAll('button');
    // Leave is the last button
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onLeave).toHaveBeenCalled();
  });

  it('shows participants button with count when onOpenParticipants provided', () => {
    wrap(<VisioControls {...baseProps} onOpenParticipants={vi.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('applies red style when muted', () => {
    const { container } = wrap(
      <VisioControls {...baseProps} mediaState={{ ...defaultMedia, isMuted: true }} />
    );
    const muteBtn = container.querySelectorAll('button')[0];
    expect(muteBtn.className).toContain('bg-red-600');
  });

  it('applies red style when video off', () => {
    const { container } = wrap(
      <VisioControls {...baseProps} mediaState={{ ...defaultMedia, isVideoOff: true }} />
    );
    const videoBtn = container.querySelectorAll('button')[1];
    expect(videoBtn.className).toContain('bg-red-600');
  });

  it('applies green style when screen sharing', () => {
    const { container } = wrap(
      <VisioControls {...baseProps} mediaState={{ ...defaultMedia, isScreenSharing: true }} />
    );
    const shareBtn = container.querySelectorAll('button')[2];
    expect(shareBtn.className).toContain('bg-green-600');
  });
});
