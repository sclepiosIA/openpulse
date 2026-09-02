/* @vitest-environment jsdom */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTitleBadge } from './useTitleBadge';

const { BADGES_ZERO, BADGES_THREE, BADGES_FOUR, BADGES_FIVE, mockUseNavigationBadges } = vi.hoisted(() => ({
  BADGES_ZERO: { total: 0 },
  BADGES_THREE: { total: 3 },
  BADGES_FOUR: { total: 4 },
  BADGES_FIVE: { total: 5 },
  mockUseNavigationBadges: vi.fn<() => { total: number }>(),
}));

vi.mock('@/hooks/ui/useNavigationBadges', () => ({
  useNavigationBadges: mockUseNavigationBadges,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useTitleBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.head.innerHTML = '<title>Dashboard | OpenPulse</title>';
    mockUseNavigationBadges.mockReturnValue(BADGES_ZERO);
  });

  it('applique le badge avec le total initial puis le retire quand le total passe à 0', async () => {
    let state = BADGES_FIVE;
    mockUseNavigationBadges.mockImplementation(() => state);

    const { rerender } = renderHook(() => useTitleBadge(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(document.title).toBe('(5) Dashboard | OpenPulse');
    });

    state = BADGES_ZERO;
    rerender();

    await waitFor(() => {
      expect(document.title).toBe('Dashboard | OpenPulse');
    });
  });

  it('réapplique le badge quand le titre est modifié après le montage', async () => {
    mockUseNavigationBadges.mockReturnValue(BADGES_THREE);

    renderHook(() => useTitleBadge(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(document.title).toBe('(3) Dashboard | OpenPulse');
    });

    document.title = 'Patients';

    await waitFor(() => {
      expect(document.title).toBe('(3) Patients');
    });
  });

  it('remplace un ancien préfixe existant au lieu de les empiler', async () => {
    document.title = '(9) Planning';
    mockUseNavigationBadges.mockReturnValue({ total: 2 });

    renderHook(() => useTitleBadge(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(document.title).toBe('(2) Planning');
    });
  });

  it('laisse le titre brut quand total vaut 0', async () => {
    mockUseNavigationBadges.mockReturnValue(BADGES_ZERO);

    renderHook(() => useTitleBadge(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(document.title).toBe('Dashboard | OpenPulse');
    });
  });

  it('déconnecte le MutationObserver au démontage et ne re-préfixe plus ensuite', async () => {
    mockUseNavigationBadges.mockReturnValue(BADGES_FOUR);

    const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');

    const { unmount } = renderHook(() => useTitleBadge(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(document.title).toBe('(4) Dashboard | OpenPulse');
    });

    unmount();

    expect(disconnectSpy).toHaveBeenCalled();

    document.title = 'Nouveau titre';
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(document.title).toBe('Nouveau titre');

    disconnectSpy.mockRestore();
  });

  it('met à jour le préfixe avec la nouvelle valeur sans conserver l ancienne', async () => {
    let state = { total: 1 };
    mockUseNavigationBadges.mockImplementation(() => state);

    const { rerender } = renderHook(() => useTitleBadge(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(document.title).toBe('(1) Dashboard | OpenPulse');
    });

    state = BADGES_THREE;
    rerender();

    await waitFor(() => {
      expect(document.title).toBe('(3) Dashboard | OpenPulse');
      expect(document.title).not.toContain('(1) (3)');
    });
  });
});