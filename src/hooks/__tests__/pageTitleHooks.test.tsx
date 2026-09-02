import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const badgeState = vi.hoisted(() => ({ total: 0 }));

vi.mock('@/hooks/ui/useNavigationBadges', () => ({
  useNavigationBadges: () => ({ total: badgeState.total }),
}));

import { usePageTitle } from '../shared/usePageTitle';
import { useTitleBadge } from '../shared/useTitleBadge';

describe('page title hooks', () => {
  beforeEach(() => {
    badgeState.total = 0;
    document.title = 'OpenPulse';
  });

  it('usePageTitle applique le titre de page puis restaure le titre par défaut au démontage', () => {
    const { unmount, rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: 'Rapports' },
    });

    expect(document.title).toBe('Rapports | OpenPulse');

    rerender({ title: 'Emails' });
    expect(document.title).toBe('Emails | OpenPulse');

    unmount();
    expect(document.title).toBe('OpenPulse');
  });

  it('useTitleBadge préfixe puis retire le nombre de notifications', () => {
    badgeState.total = 5;
    document.title = 'Dashboard | OpenPulse';

    const { rerender } = renderHook(() => useTitleBadge());

    expect(document.title).toBe('(5) Dashboard | OpenPulse');

    badgeState.total = 0;
    rerender();

    expect(document.title).toBe('Dashboard | OpenPulse');
  });

  it('useTitleBadge réapplique le badge après une modification externe du title', async () => {
    badgeState.total = 2;
    document.title = 'Accueil | OpenPulse';

    renderHook(() => useTitleBadge());

    act(() => {
      document.title = 'Emails | OpenPulse';
    });

    await waitFor(() => expect(document.title).toBe('(2) Emails | OpenPulse'));
  });
});