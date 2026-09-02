import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('notificationSound', () => {
  let createOscillatorMock: ReturnType<typeof vi.fn>;
  let createGainMock: ReturnType<typeof vi.fn>;
  let resumeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    createOscillatorMock = vi.fn(() => ({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    }));
    createGainMock = vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
    }));
    resumeMock = vi.fn();
    // jsdom doesn't ship AudioContext — install a stub
    (globalThis as any).AudioContext = vi.fn(() => ({
      currentTime: 0,
      state: 'suspended',
      resume: resumeMock,
      destination: {},
      createOscillator: createOscillatorMock,
      createGain: createGainMock,
    }));
  });

  it('plays two oscillators (chime: C6 + E6)', async () => {
    const { playNotificationSound } = await import('../notificationSound');
    playNotificationSound();
    expect(createOscillatorMock).toHaveBeenCalledTimes(2);
    expect(createGainMock).toHaveBeenCalledTimes(2);
  });

  it('resumes a suspended AudioContext', async () => {
    const { playNotificationSound } = await import('../notificationSound');
    playNotificationSound();
    expect(resumeMock).toHaveBeenCalled();
  });

  it('does not throw if AudioContext construction fails', async () => {
    (globalThis as any).AudioContext = vi.fn(() => {
      throw new Error('audio disabled');
    });
    const { playNotificationSound } = await import('../notificationSound');
    expect(() => playNotificationSound()).not.toThrow();
  });

  it('reuses the cached AudioContext across calls', async () => {
    const ctor = (globalThis as any).AudioContext as ReturnType<typeof vi.fn>;
    const { playNotificationSound } = await import('../notificationSound');
    playNotificationSound();
    playNotificationSound();
    expect(ctor).toHaveBeenCalledTimes(1);
  });
});
