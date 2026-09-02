import { describe, it, expect, vi, beforeEach } from 'vitest';

const isNativeAppMock = vi.fn();
const notifyAppReadyMock = vi.fn();

vi.mock('@/lib/capacitor', () => ({ isNativeApp: isNativeAppMock }));
vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: { notifyAppReady: notifyAppReadyMock },
}));

describe('liveUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops when not running in native app', async () => {
    isNativeAppMock.mockReturnValue(false);
    const { initLiveUpdates } = await import('../liveUpdates');
    await initLiveUpdates();
    expect(notifyAppReadyMock).not.toHaveBeenCalled();
  });

  it('calls notifyAppReady when running in native app', async () => {
    isNativeAppMock.mockReturnValue(true);
    notifyAppReadyMock.mockResolvedValue(undefined);
    const { initLiveUpdates } = await import('../liveUpdates');
    await initLiveUpdates();
    expect(notifyAppReadyMock).toHaveBeenCalledTimes(1);
  });

  it('swallows errors from notifyAppReady (never throws)', async () => {
    isNativeAppMock.mockReturnValue(true);
    notifyAppReadyMock.mockRejectedValue(new Error('boom'));
    const { initLiveUpdates } = await import('../liveUpdates');
    await expect(initLiveUpdates()).resolves.toBeUndefined();
  });
});
