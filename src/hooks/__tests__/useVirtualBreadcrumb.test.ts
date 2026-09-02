import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockPush = vi.fn();
const mockPop = vi.fn();
const mockReplace = vi.fn();

vi.mock('../shared/useNavigationHistory', () => ({
  useNavigationHistory: () => ({
    pushVirtualEntry: mockPush,
    popVirtualEntry: mockPop,
    replaceCurrentLabel: mockReplace,
  }),
}));

import { useVirtualBreadcrumb } from '../shared/useVirtualBreadcrumb';

describe('useVirtualBreadcrumb', () => {
  it('pushEntry delegates to pushVirtualEntry', () => {
    const { result } = renderHook(() => useVirtualBreadcrumb());
    const onBack = vi.fn();
    result.current.pushEntry('Label', onBack, '/path', 'tab');
    expect(mockPush).toHaveBeenCalledWith('Label', onBack, '/path', 'tab');
  });

  it('popEntry delegates to popVirtualEntry', () => {
    const { result } = renderHook(() => useVirtualBreadcrumb());
    result.current.popEntry();
    expect(mockPop).toHaveBeenCalled();
  });

  it('updateLabel delegates to replaceCurrentLabel', () => {
    const { result } = renderHook(() => useVirtualBreadcrumb());
    result.current.updateLabel('New Label');
    expect(mockReplace).toHaveBeenCalledWith('New Label');
  });
});
