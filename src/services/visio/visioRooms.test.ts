const { ROOM, mockInvoke } = vi.hoisted(() => ({
  ROOM: {
    id: 'room-1',
    code: 'ABC123',
    name: 'Consultation Dr Test',
    provider: 'marque_meet',
  },
  mockInvoke: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import { fetchVisioRoom } from './visioRooms';

describe('fetchVisioRoom', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('appelle la edge function webrtc-signaling avec action get-room et le roomCode', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, room: ROOM }, error: null });

    await fetchVisioRoom('ABC123');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('webrtc-signaling', {
      body: { action: 'get-room', roomCode: 'ABC123' },
    });
  });

  it('retourne la salle quand la réponse est un succès', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, room: ROOM }, error: null });

    const room = await fetchVisioRoom('ABC123');

    expect(room).toBe(ROOM);
    expect(room.id).toBe('room-1');
    expect(room.code).toBe('ABC123');
    expect(room.name).toBe('Consultation Dr Test');
  });

  it("lève l'erreur renvoyée par la edge function (error non nul)", async () => {
    const edgeError = { message: 'x' };
    mockInvoke.mockResolvedValue({ data: null, error: edgeError });

    await expect(fetchVisioRoom('ABC123')).rejects.toBe(edgeError);
  });

  it("lève une erreur avec le message renvoyé quand success=false avec data.error", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'Salle expirée' },
      error: null,
    });

    await expect(fetchVisioRoom('ABC123')).rejects.toThrow('Salle expirée');
  });

  it("lève 'Salle introuvable' quand success=false sans message d'erreur", async () => {
    mockInvoke.mockResolvedValue({ data: { success: false }, error: null });

    await expect(fetchVisioRoom('ZZZ999')).rejects.toThrow('Salle introuvable');
  });

  it("lève 'Salle introuvable' quand data est null sans erreur", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(fetchVisioRoom('ABC123')).rejects.toThrow('Salle introuvable');
  });
});