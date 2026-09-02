// @vitest-environment jsdom

import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePageTitle } from './usePageTitle';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('usePageTitle', () => {
  it('définit le titre du document avec le suffixe applicatif au montage', () => {
    document.title = 'Initial';

    const wrapper = createWrapper();

    renderHook(() => usePageTitle('Tableau de bord'), { wrapper });

    expect(document.title).toBe('Tableau de bord | OpenPulse');
  });

  it('met à jour le titre quand la valeur title change', () => {
    document.title = 'Initial';

    const wrapper = createWrapper();

    const { rerender } = renderHook(
      ({ title }: { title: string }) => {
        usePageTitle(title);
      },
      {
        initialProps: { title: 'Patients' },
        wrapper,
      }
    );

    expect(document.title).toBe('Patients | OpenPulse');

    rerender({ title: 'Rendez-vous' });

    expect(document.title).toBe('Rendez-vous | OpenPulse');
  });

  it('restaure le titre par défaut au démontage', () => {
    document.title = 'Initial';

    const wrapper = createWrapper();

    const { unmount } = renderHook(() => usePageTitle('Paramètres'), { wrapper });

    expect(document.title).toBe('Paramètres | OpenPulse');

    unmount();

    expect(document.title).toBe('OpenPulse');
  });

  it('remplace le titre précédent et conserve exactement le suffixe attendu', () => {
    document.title = 'Ancien titre';

    const wrapper = createWrapper();

    renderHook(() => usePageTitle('Consultations'), { wrapper });

    expect(document.title).toBe('Consultations | OpenPulse');
    expect(document.title).not.toBe('Ancien titre');
    expect(document.title.endsWith('OpenPulse')).toBe(true);
  });
});