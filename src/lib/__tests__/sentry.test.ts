import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/monitoring', () => ({
  monitoring: { init: vi.fn() },
}));

import { initSentry } from '@/lib/sentry';
import { monitoring } from '@/lib/monitoring';

describe('sentry', () => {
  it('initSentry delegates to monitoring.init', () => {
    initSentry();
    expect(monitoring.init).toHaveBeenCalled();
  });
});
