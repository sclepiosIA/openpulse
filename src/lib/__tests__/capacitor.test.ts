import { describe, it, expect, vi, beforeEach } from 'vitest';

const isNativePlatformMock = vi.fn();
const getPlatformMock = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: isNativePlatformMock,
    getPlatform: getPlatformMock,
  },
}));

describe('capacitor helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isNativeApp', () => {
    it('returns true when Capacitor reports native', async () => {
      isNativePlatformMock.mockReturnValue(true);
      const { isNativeApp } = await import('../capacitor');
      expect(isNativeApp()).toBe(true);
    });

    it('returns false on web', async () => {
      isNativePlatformMock.mockReturnValue(false);
      const { isNativeApp } = await import('../capacitor');
      expect(isNativeApp()).toBe(false);
    });
  });

  describe('getPlatform', () => {
    it("returns 'ios' for iOS", async () => {
      getPlatformMock.mockReturnValue('ios');
      const { getPlatform } = await import('../capacitor');
      expect(getPlatform()).toBe('ios');
    });

    it("returns 'android' for Android", async () => {
      getPlatformMock.mockReturnValue('android');
      const { getPlatform } = await import('../capacitor');
      expect(getPlatform()).toBe('android');
    });

    it("returns 'web' for browser", async () => {
      getPlatformMock.mockReturnValue('web');
      const { getPlatform } = await import('../capacitor');
      expect(getPlatform()).toBe('web');
    });

    it("normalises unknown platforms to 'web'", async () => {
      getPlatformMock.mockReturnValue('unknown');
      const { getPlatform } = await import('../capacitor');
      expect(getPlatform()).toBe('web');
    });
  });
});
