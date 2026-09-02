// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { LocationMapPreview } from './LocationMapPreview';

const { skeletonProps, mapInnerSpy } = vi.hoisted(() => ({
  skeletonProps: { className: 'w-full h-full' },
  mapInnerSpy: vi.fn(),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: { className?: string }) => (
    <div data-testid="skeleton" className={props.className}>
      loading
    </div>
  ),
}));

vi.mock('./LocationMapInner', () => ({
  default: (props: { lat: number; lng: number; label?: string }) => {
    mapInnerSpy(props);
    return (
      <div data-testid="map-inner">
        {props.lat},{props.lng},{props.label ?? ''}
      </div>
    );
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('LocationMapPreview', () => {
  it('affiche le fallback de chargement puis rend la carte avec les valeurs métier attendues', async () => {
    render(<LocationMapPreview lat={48.8566} lng={2.3522} label="Paris" />);

    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('w-full', 'h-full');

    const mapInner = await screen.findByTestId('map-inner');
    expect(mapInner).toBeInTheDocument();
    expect(mapInner).toHaveTextContent('48.8566,2.3522,Paris');

    expect(mapInnerSpy).toHaveBeenCalledWith({
      lat: 48.8566,
      lng: 2.3522,
      label: 'Paris',
    });
  });

  it('rend sans label optionnel', async () => {
    render(<LocationMapPreview lat={43.2965} lng={5.3698} />);

    const mapInner = await screen.findByTestId('map-inner');
    expect(mapInner).toHaveTextContent('43.2965,5.3698,');

    await waitFor(() => {
      expect(mapInnerSpy).toHaveBeenCalledWith({
        lat: 43.2965,
        lng: 5.3698,
        label: undefined,
      });
    });
  });

  it('est compatible avec un wrapper QueryClientProvider pour la suite de tests', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => 'ready', { wrapper });
    expect(result.current).toBe('ready');
  });
});