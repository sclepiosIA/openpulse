/* @vitest-environment jsdom */
/**
 * Tests useDriveSpaces / useDriveTree — activation conditionnelle
 * (aucun appel réseau si disabled) et propagation des données.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDriveSpaces } from './useDriveSpaces';
import { useDriveTree } from './useDriveTree';

const { fetchDriveSpacesMock, fetchDriveTreeMock } = vi.hoisted(() => ({
  fetchDriveSpacesMock: vi.fn(),
  fetchDriveTreeMock: vi.fn(),
}));

vi.mock('@/lib/drive/driveClient', () => ({
  fetchDriveSpaces: fetchDriveSpacesMock,
  fetchDriveTree: fetchDriveTreeMock,
}));

const SPACES = [
  {
    id: 'space-1',
    name: 'OpenPulse',
    slug: 'gsi',
    type: 'gsi',
    etablissement_id: null,
    sensitivity: 'standard',
    sync_policy: 'allowed',
    status: 'active',
    created_at: '2026-07-07T00:00:00Z',
    updated_at: '2026-07-07T00:00:00Z',
  },
];

const TREE = {
  space_id: 'space-1',
  folders: [],
  files: [
    {
      id: 'file-1',
      space_id: 'space-1',
      folder_id: null,
      name: 'contrat.pdf',
      path: '/DPO/contrat.pdf',
      content_type: 'application/pdf',
      size_bytes: 1024,
      sha256: null,
      etag: null,
      current_version: 2,
      status: 'active',
      reference_framework: 'rgpd',
      evidence_status: 'current',
      valid_from: null,
      valid_until: null,
      created_at: '2026-07-07T00:00:00Z',
      updated_at: '2026-07-07T00:00:00Z',
    },
  ],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDriveSpaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchDriveSpacesMock.mockResolvedValue(SPACES);
    fetchDriveTreeMock.mockResolvedValue(TREE);
  });

  it('charge les espaces quand enabled', async () => {
    const { result } = renderHook(() => useDriveSpaces(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SPACES);
    expect(fetchDriveSpacesMock).toHaveBeenCalledTimes(1);
  });

  it("n'appelle PAS l'API quand enabled=false (mode legacy)", async () => {
    const { result } = renderHook(() => useDriveSpaces({ enabled: false }), {
      wrapper: createWrapper(),
    });

    // fetchStatus idle = requête jamais déclenchée
    expect(result.current.fetchStatus).toBe('idle');
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchDriveSpacesMock).not.toHaveBeenCalled();
  });

  it('remonte isError si le client échoue', async () => {
    // retry: 1 dans le hook → il faut rejeter TOUTES les tentatives.
    fetchDriveSpacesMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDriveSpaces(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4000 });
  });
});

describe('useDriveTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchDriveTreeMock.mockResolvedValue(TREE);
  });

  it("charge l'arborescence pour un espace donné", async () => {
    const { result } = renderHook(() => useDriveTree('space-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.files).toHaveLength(1);
    expect(fetchDriveTreeMock).toHaveBeenCalledWith('space-1', expect.anything());
  });

  it("reste idle sans spaceId (pas d'appel)", async () => {
    const { result } = renderHook(() => useDriveTree(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchDriveTreeMock).not.toHaveBeenCalled();
  });

  it('reste idle quand enabled=false même avec un spaceId', async () => {
    const { result } = renderHook(() => useDriveTree('space-1', { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchDriveTreeMock).not.toHaveBeenCalled();
  });
});
