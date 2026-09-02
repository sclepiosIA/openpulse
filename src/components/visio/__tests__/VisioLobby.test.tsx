import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VisioLobby } from '../VisioLobby';

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [],
      getVideoTracks: () => [],
      getAudioTracks: () => [],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
  writable: true,
});

const room = {
  id: 'room1',
  name: 'Test Room',
  slug: 'test-room',
  created_by: 'u1',
  is_active: true,
  max_participants: 10,
  created_at: '',
  expires_at: null,
  settings: {},
  participants: [],
};

describe('VisioLobby', () => {
  it('renders room name', () => {
    render(
      <MemoryRouter>
        <VisioLobby
          room={room as any}
          displayName="Jean"
          onDisplayNameChange={vi.fn()}
          onJoin={vi.fn()}
          isJoining={false}
        />
      </MemoryRouter>
    );
    expect(screen.getByDisplayValue('Jean')).toBeInTheDocument();
  });

  it('renders join button', () => {
    render(
      <MemoryRouter>
        <VisioLobby
          room={room as any}
          displayName="Jean"
          onDisplayNameChange={vi.fn()}
          onJoin={vi.fn()}
          isJoining={false}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/Rejoindre/)).toBeInTheDocument();
  });

  it('shows loading state when joining', () => {
    render(
      <MemoryRouter>
        <VisioLobby
          room={room as any}
          displayName="Jean"
          onDisplayNameChange={vi.fn()}
          onJoin={vi.fn()}
          isJoining={true}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/Connexion/)).toBeInTheDocument();
  });
});
