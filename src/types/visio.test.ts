import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ICE_SERVERS, VIDEO_CONSTRAINTS } from './visio';

const { ERROR_MESSAGE } = vi.hoisted(() => ({
  ERROR_MESSAGE: 'load_error',
}));

type VisioData = {
  servers: RTCIceServer[];
  constraints: typeof VIDEO_CONSTRAINTS;
};

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children as React.ReactNode);
  };
}

function useLoadVisio(fetcher?: () => Promise<VisioData>) {
  const defaultFetcher = async (): Promise<VisioData> => ({
    servers: ICE_SERVERS,
    constraints: VIDEO_CONSTRAINTS,
  });
  return useQuery<VisioData, Error>({
    queryKey: ['visio_constants'],
    queryFn: fetcher ?? defaultFetcher,
  });
}

describe('visio constants', () => {
  it('exporte ICE_SERVERS et VIDEO_CONSTRAINTS avec les valeurs attendues', () => {
    expect(Array.isArray(ICE_SERVERS)).toBe(true);
    expect(ICE_SERVERS).toHaveLength(5);
    expect(ICE_SERVERS[0]).toEqual({ urls: 'stun:stun.l.google.com:19302' });
    expect(ICE_SERVERS[4]).toEqual({ urls: 'stun:stun4.l.google.com:19302' });

    expect(VIDEO_CONSTRAINTS.low.width).toBe(320);
    expect(VIDEO_CONSTRAINTS.low.height).toBe(240);
    expect(VIDEO_CONSTRAINTS.low.frameRate).toBe(15);

    expect(VIDEO_CONSTRAINTS.medium.width).toBe(640);
    expect(VIDEO_CONSTRAINTS.medium.height).toBe(480);
    expect(VIDEO_CONSTRAINTS.medium.frameRate).toBe(24);

    expect(VIDEO_CONSTRAINTS.high.width).toBe(1280);
    expect(VIDEO_CONSTRAINTS.high.height).toBe(720);
    expect(VIDEO_CONSTRAINTS.high.frameRate).toBe(30);
  });

  it('chargement puis succès via useQuery avec renderHook (wrapper QueryClientProvider)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useLoadVisio(), { wrapper });

    expect(result.current.isLoading || (result.current as any).isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data).toBeDefined();
    if (data) {
      expect(data.servers).toHaveLength(5);
      expect(data.servers.some(s => s.urls === 'stun:stun3.l.google.com:19302')).toBe(true);
      expect(data.constraints.high.width).toBe(1280);
      expect(data.constraints.medium.frameRate).toBe(24);
    }
  });

  it('erreur: queryFn rejette et isError est vrai avec le message attendu', async () => {
    const wrapper = createWrapper();
    const errorFetcher = vi.fn(async () => {
      throw new Error(ERROR_MESSAGE);
    });

    const { result } = renderHook(() => useLoadVisio(errorFetcher), { wrapper });

    expect(result.current.isLoading || (result.current as any).isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(errorFetcher).toHaveBeenCalledTimes(1);

    const err = result.current.error;
    expect(err).toBeInstanceOf(Error);
    if (err instanceof Error) {
      expect(err.message).toBe(ERROR_MESSAGE);
    }
  });
})