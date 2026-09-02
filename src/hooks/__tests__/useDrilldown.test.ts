import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/contexts/RapportsDrilldownContext', () => ({
  RapportsDrilldownContext: { Provider: ({ children }: any) => children },
}));

describe('useDrilldown', () => {
  it('throws when used outside provider', async () => {
    // Re-mock with null context
    vi.doMock('@/contexts/RapportsDrilldownContext', () => {
      const { createContext } = require('react');
      return { RapportsDrilldownContext: createContext(null) };
    });
    const { useDrilldown } = await import('../analytics/useDrilldown');
    expect(() => renderHook(() => useDrilldown())).toThrow('useDrilldown must be used within RapportsDrilldownProvider');
  });
});
