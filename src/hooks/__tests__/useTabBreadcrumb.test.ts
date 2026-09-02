import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockPush = vi.fn();
const mockPop = vi.fn();
const mockUpdateLabel = vi.fn();

vi.mock('../shared/useVirtualBreadcrumb', () => ({
  useVirtualBreadcrumb: () => ({
    pushEntry: mockPush,
    popEntry: mockPop,
    updateLabel: mockUpdateLabel,
  }),
}));

import { useTabBreadcrumb } from '../ui/useTabBreadcrumb';

describe('useTabBreadcrumb', () => {
  const config = {
    pageLabel: 'CRM',
    parentPath: '/crm',
    tabLabels: { overview: 'Vue d\'ensemble', pipeline: 'Pipeline', contacts: 'Contacts' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pushes breadcrumb entry on mount with tab label', () => {
    renderHook(() => useTabBreadcrumb(config, 'overview'));
    expect(mockPush).toHaveBeenCalledWith('Vue d\'ensemble', expect.any(Function), '/crm', 'tab');
  });

  it('pops on unmount', () => {
    const { unmount } = renderHook(() => useTabBreadcrumb(config, 'overview'));
    unmount();
    expect(mockPop).toHaveBeenCalled();
  });

  it('includes subLabel in breadcrumb', () => {
    renderHook(() => useTabBreadcrumb(config, 'pipeline', 'Détails'));
    expect(mockPush).toHaveBeenCalledWith('Pipeline > Détails', expect.any(Function), '/crm', 'tab');
  });

  it('updateSubLabel delegates to updateLabel', () => {
    const { result } = renderHook(() => useTabBreadcrumb(config, 'contacts'));
    result.current.updateSubLabel('Nouveau');
    expect(mockUpdateLabel).toHaveBeenCalledWith('Contacts > Nouveau');
  });

  it('wrapTabChange returns function that calls handler', () => {
    const { result } = renderHook(() => useTabBreadcrumb(config, 'overview'));
    const handler = vi.fn();
    const wrapped = result.current.wrapTabChange(handler);
    wrapped('pipeline');
    expect(handler).toHaveBeenCalledWith('pipeline');
  });
});
