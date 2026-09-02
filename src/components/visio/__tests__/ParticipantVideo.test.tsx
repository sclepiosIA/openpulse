import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParticipantVideo } from '../ParticipantVideo';

const baseParticipant = {
  id: 'p1',
  user_id: 'u1',
  display_name: 'Jean Dupont',
  is_muted: false,
  is_video_off: false,
  is_screen_sharing: false,
  joined_at: new Date().toISOString(),
  connection_quality: 'good' as const,
};

describe('ParticipantVideo', () => {
  it('renders participant name', () => {
    render(<ParticipantVideo participant={baseParticipant} />);
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });

  it('shows (Vous) suffix for local participant', () => {
    render(<ParticipantVideo participant={baseParticipant} isLocal />);
    expect(screen.getByText(/Jean Dupont.*\(Vous\)/)).toBeInTheDocument();
  });

  it('shows initials when video off', () => {
    const p = { ...baseParticipant, is_video_off: true };
    render(<ParticipantVideo participant={p} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('shows ? for empty name', () => {
    const p = { ...baseParticipant, display_name: '' };
    render(<ParticipantVideo participant={p} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows screen sharing indicator', () => {
    const p = { ...baseParticipant, is_screen_sharing: true };
    render(<ParticipantVideo participant={p} />);
    expect(screen.getByText("Partage d'écran")).toBeInTheDocument();
  });

  it('shows bad connection quality indicator', () => {
    const p = { ...baseParticipant, connection_quality: 'poor' as const };
    render(<ParticipantVideo participant={p} />);
    expect(screen.getByText('Mauvaise connexion')).toBeInTheDocument();
  });

  it('shows fair connection quality indicator', () => {
    const p = { ...baseParticipant, connection_quality: 'fair' as const };
    render(<ParticipantVideo participant={p} />);
    expect(screen.getByText('Connexion moyenne')).toBeInTheDocument();
  });

  it('does not show connection indicator for local', () => {
    const p = { ...baseParticipant, connection_quality: 'poor' as const };
    render(<ParticipantVideo participant={p} isLocal />);
    expect(screen.queryByText('Mauvaise connexion')).toBeNull();
  });

  it('applies speaking ring when isSpeaking', () => {
    const { container } = render(<ParticipantVideo participant={baseParticipant} isSpeaking />);
    expect(container.firstElementChild?.className).toContain('ring-2');
  });
});
