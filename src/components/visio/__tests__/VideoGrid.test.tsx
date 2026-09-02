import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoGrid } from '../VideoGrid';

// Polyfill MediaStream for jsdom
beforeAll(() => {
  if (!globalThis.MediaStream) {
    globalThis.MediaStream = class {
      getTracks() { return []; }
      getVideoTracks() { return []; }
      getAudioTracks() { return []; }
    } as any;
  }
});

const localParticipant = {
  id: 'p-local',
  user_id: 'local',
  display_name: 'Moi',
  is_muted: false,
  is_video_off: true,
  is_screen_sharing: false,
  joined_at: new Date().toISOString(),
  connection_quality: 'good' as const,
};

const remoteParticipant = {
  id: 'p-remote1',
  user_id: 'remote1',
  display_name: 'Alice Martin',
  is_muted: false,
  is_video_off: true,
  is_screen_sharing: false,
  joined_at: new Date().toISOString(),
  connection_quality: 'good' as const,
};

describe('VideoGrid', () => {
  it('renders local participant', () => {
    render(<VideoGrid localParticipant={localParticipant} remoteStreams={[]} />);
    expect(screen.getByText(/Moi/)).toBeInTheDocument();
  });

  it('renders remote participants', () => {
    const remoteStreams = [{ peerId: 'p1', stream: new MediaStream(), participant: remoteParticipant }];
    render(<VideoGrid localParticipant={localParticipant} remoteStreams={remoteStreams} />);
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
  });

  it('uses grid-cols-1 for solo participant', () => {
    const { container } = render(<VideoGrid localParticipant={localParticipant} remoteStreams={[]} />);
    expect(container.querySelector('.grid-cols-1')).toBeTruthy();
  });

  it('uses grid layout for multiple participants', () => {
    const remotes = [
      { peerId: 'p1', stream: new MediaStream(), participant: remoteParticipant },
      { peerId: 'p2', stream: new MediaStream(), participant: { ...remoteParticipant, id: 'p-r2', user_id: 'r2', display_name: 'Bob' } },
      { peerId: 'p3', stream: new MediaStream(), participant: { ...remoteParticipant, id: 'p-r3', user_id: 'r3', display_name: 'Claire' } },
    ];
    const { container } = render(<VideoGrid localParticipant={localParticipant} remoteStreams={remotes} />);
    expect(container.querySelector('.grid-cols-2')).toBeTruthy();
  });

  it('renders screen sharing layout when active', () => {
    const screenStream = new MediaStream();
    const { container } = render(
      <VideoGrid localParticipant={localParticipant} remoteStreams={[]} screenStream={screenStream} isScreenSharing />
    );
    expect(container.querySelector('.flex-col')).toBeTruthy();
  });
});
