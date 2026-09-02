import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/etablissements' }),
  useParams: () => ({}),
}));

vi.mock('@/hooks/jarvis/useJarvisFocus', () => ({
  useJarvisFocus: () => ({
    focus: null,
    setFocus: vi.fn(),
    clearFocus: vi.fn(),
  }),
}));

import { useJarvisContextualActions } from '../jarvis/useJarvisContextualActions';

describe('useJarvisContextualActions', () => {
  it('returns quick actions for /etablissements route', () => {
    const { result } = renderHook(() => useJarvisContextualActions());
    expect(result.current.quickActions.length).toBeGreaterThan(0);
    expect(result.current.hasContext).toBe(true);
    expect(result.current.contextLabel).toBeTruthy();
  });

  it('includes global actions', () => {
    const { result } = renderHook(() => useJarvisContextualActions());
    const ids = result.current.quickActions.map(a => a.id);
    expect(ids).toContain('daily_summary');
    expect(ids).toContain('urgent_tasks');
  });

  it('includes route-specific actions for etablissements', () => {
    const { result } = renderHook(() => useJarvisContextualActions());
    const ids = result.current.quickActions.map(a => a.id);
    expect(ids).toContain('pipeline_status');
    expect(ids).toContain('cold_prospects');
  });

  it('actions have required fields', () => {
    const { result } = renderHook(() => useJarvisContextualActions());
    result.current.quickActions.forEach(action => {
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('label');
      expect(action).toHaveProperty('prompt');
      expect(action).toHaveProperty('category');
      expect(action).toHaveProperty('priority');
    });
  });

  it('actions are sorted by priority', () => {
    const { result } = renderHook(() => useJarvisContextualActions());
    const priorities = result.current.quickActions.map(a => a.priority);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
    }
  });
});
