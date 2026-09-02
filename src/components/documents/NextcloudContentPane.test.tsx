import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react';
import React, { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  FOLDERS,
  FILES,
  mockUseNextcloudFolderContents,
  mockGetNextcloudPathFromId,
  mockCreateNextcloudFolderId,
  mockGetNextcloudDownloadUrl,
  mockFormatFileSize,
  mockSafeFormat,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  mockFrom,
} = vi.hoisted(() => {
  const mockUseNextcloudFolderContents = vi.fn();
  const mockGetNextcloudPathFromId = vi.fn();
  const mockCreateNextcloudFolderId = vi.fn((p: string) => `nextcloud:${p}`);
  const mockGetNextcloudDownloadUrl = vi.fn();
  const mockFormatFileSize = vi.fn();
  const mockSafeFormat = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockDebugError = vi.fn();
  const FOLDERS = [
    { path: '/root/Docs', name: 'Docs', lastModified: '2024-01-02T10:00:00Z' },
    { path: '/root/Images', name: 'Images', lastModified: '2024-01-03T11:00:00Z' },
  ];
  const FILES = [
    { path: '/root/photo.jpg', name: 'photo.jpg', size: 1048576, mimeType: 'image/jpeg', lastModified: '2024-01-04T12:00:00Z' },
    { path: '/root/report.pdf', name: 'report.pdf', size: 2048, mimeType: 'application/pdf', lastModified: '2024-01-05T13:00:00Z' },
  ];
  const mockFrom = vi.fn(() => {
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (res: any, rej: any) => Promise.resolve({ data: null, error: null }).then(res, rej),
      catch: (rej: any) => Promise.resolve({ data: null, error: null }).catch(rej),
    };
    return builder;
  });
  return {
    FOLDERS,
    FILES,
    mockUseNextcloudFolderContents,
    mockGetNextcloudPathFromId,
    mockCreateNextcloudFolderId,
    mockGetNextcloudDownloadUrl,
    mockFormatFileSize,
    mockSafeFormat,
    mockToastSuccess,
    mockToastError,
    mockDebugError,
    mockFrom,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: (...args: unknown[]) => mockDebugError(...args),
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('lucide-react', () => {
  const mk = (name: string) => (props: any) => React.createElement('svg', { 'data-icon': name, ...props });
  return {
    FolderOpen: mk('FolderOpen'),
    FileIcon: mk('FileIcon'),
    Loader2: mk('Loader2'),
    Download: mk('Download'),
    Cloud: mk('Cloud'),
    File: mk('File'),
    FileText: mk('FileText'),
    FileImage: mk('FileImage'),
    FileVideo: mk('FileVideo'),
    FileAudio: mk('FileAudio'),
    FileSpreadsheet: mk('FileSpreadsheet'),
    FileCode: mk('FileCode'),
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...rest }: PropsWithChildren<any>) => <span role="status" {...rest}>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...rest }: PropsWithChildren<any>) => <button type="button" {...rest}>{children}</button>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...rest }: PropsWithChildren<any>) => <div data-testid="scroll-area" {...rest}>{children}</div>,
}));

vi.mock('@/hooks/documents/useNextcloudFolderTree', () => ({
  useNextcloudFolderContents: (...args: any[]) => mockUseNextcloudFolderContents(...args),
  getNextcloudPathFromId: (...args: any[]) => mockGetNextcloudPathFromId(...args),
  createNextcloudFolderId: (...args: any[]) => mockCreateNextcloudFolderId(...args),
}));

vi.mock('@/hooks/documents/useNextcloudStorage', () => ({
  getNextcloudDownloadUrl: (...args: any[]) => mockGetNextcloudDownloadUrl(...args),
}));

vi.mock('@/types/documents', () => ({
  formatFileSize: (...args: any[]) => mockFormatFileSize(...args),
}));

vi.mock('@/lib/safeDate', () => ({
  safeFormat: (...args: any[]) => mockSafeFormat(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

import { NextcloudContentPane } from './NextcloudContentPane';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe('NextcloudContentPane', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNextcloudPathFromId.mockReturnValue('/root');
    mockCreateNextcloudFolderId.mockImplementation((p: string) => `nextcloud:${p}`);
    mockFormatFileSize.mockReturnValue('FSIZE');
    mockSafeFormat.mockReturnValue('DATE');
    mockUseNextcloudFolderContents.mockReturnValue({ data: undefined, isLoading: false, error: undefined });
    mockGetNextcloudDownloadUrl.mockResolvedValue('https://nextcloud.local/download');
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('affiche le loader pendant le chargement', () => {
    mockUseNextcloudFolderContents.mockReturnValue({ data: undefined, isLoading: true, error: undefined });

    const wrapper = createWrapper();
    render(
      <NextcloudContentPane folderId="nextcloud:/root" viewMode="grid" onFolderClick={vi.fn()} />,
      { wrapper }
    );

    expect(document.querySelector('.animate-spin')).not.toBeNull();
    expect(mockUseNextcloudFolderContents).toHaveBeenCalledWith('/root');
  });

  it('affiche les dossiers et fichiers en mode grid et permet la navigation et le téléchargement', async () => {
    mockUseNextcloudFolderContents.mockReturnValue({ data: { folders: FOLDERS, files: FILES }, isLoading: false, error: undefined });
    mockGetNextcloudDownloadUrl.mockResolvedValue('https://dl.local/photo.jpg');

    const onFolderClick = vi.fn();
    const wrapper = createWrapper();
    render(
      <NextcloudContentPane folderId="nextcloud:/root" viewMode="grid" onFolderClick={onFolderClick} />,
      { wrapper }
    );

    // Dossiers section visible
    expect(screen.getByText('Dossiers')).toBeInTheDocument();
    // Dossier name visible
    expect(screen.getByText('Docs')).toBeInTheDocument();

    // Navigation to folder on click
    fireEvent.click(screen.getByText('Docs'));
    expect(onFolderClick).toHaveBeenCalledWith('nextcloud:/root/Docs');

    // Fichiers section visible
    expect(screen.getByText('Fichiers')).toBeInTheDocument();
    // File names visible
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();

    // Formatted size and date shown from mocks
    expect(screen.getAllByText('FSIZE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DATE').length).toBeGreaterThan(0);

    // Download click
    const downloadBtn = screen.getAllByRole('button', { name: 'Télécharger' })[0];
    await act(async () => {
      fireEvent.click(downloadBtn);
    });

    expect(mockGetNextcloudDownloadUrl).toHaveBeenCalledWith('/root/photo.jpg');
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('https://dl.local/photo.jpg', '_blank');
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Téléchargement de photo.jpg');
  });

  it('affiche les dossiers et fichiers en mode list et permet le téléchargement via l’icône', async () => {
    mockUseNextcloudFolderContents.mockReturnValue({ data: { folders: FOLDERS, files: FILES }, isLoading: false, error: undefined });
    mockGetNextcloudDownloadUrl.mockResolvedValue('https://dl.local/report.pdf');

    const wrapper = createWrapper();
    render(
      <NextcloudContentPane folderId="nextcloud:/root" viewMode="list" onFolderClick={vi.fn()} />,
      { wrapper }
    );

    // Folder line shows date
    expect(screen.getAllByText('DATE').length).toBeGreaterThan(0);

    // Find the download icon button for report.pdf (aria-label)
    const downloadButtons = screen.getAllByRole('button', { name: 'Télécharger' });
    // There should be one per file
    expect(downloadButtons.length).toBeGreaterThanOrEqual(2);

    // Click the second one (assuming order matches FILES)
    await act(async () => {
      fireEvent.click(downloadButtons[1]);
    });

    expect(mockGetNextcloudDownloadUrl).toHaveBeenCalledWith('/root/report.pdf');
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('https://dl.local/report.pdf', '_blank');
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Téléchargement de report.pdf');
  });

  it('affiche l’erreur Nextcloud avec le message', () => {
    mockUseNextcloudFolderContents.mockReturnValue({ data: undefined, isLoading: false, error: new Error('Connexion échouée') });

    const wrapper = createWrapper();
    render(
      <NextcloudContentPane folderId="nextcloud:/root" viewMode="grid" onFolderClick={vi.fn()} />,
      { wrapper }
    );

    expect(screen.getByText('Erreur de connexion Nextcloud')).toBeInTheDocument();
    expect(screen.getByText('Connexion échouée')).toBeInTheDocument();
  });

  it('affiche l’état vide quand aucun élément', () => {
    mockUseNextcloudFolderContents.mockReturnValue({ data: { folders: [], files: [] }, isLoading: false, error: undefined });

    const wrapper = createWrapper();
    render(
      <NextcloudContentPane folderId="nextcloud:/root" viewMode="grid" onFolderClick={vi.fn()} />,
      { wrapper }
    );

    expect(screen.getByText('Ce dossier Nextcloud est vide')).toBeInTheDocument();
  });

  it('gère l’échec du téléchargement et affiche un toast d’erreur', async () => {
    mockUseNextcloudFolderContents.mockReturnValue({ data: { folders: [], files: FILES }, isLoading: false, error: undefined });
    mockGetNextcloudDownloadUrl.mockRejectedValue(new Error('fail'));

    const wrapper = createWrapper();
    render(
      <NextcloudContentPane folderId="nextcloud:/root" viewMode="grid" onFolderClick={vi.fn()} />,
      { wrapper }
    );

    const downloadBtn = screen.getAllByRole('button', { name: 'Télécharger' })[0];

    await act(async () => {
      fireEvent.click(downloadBtn);
    });

    expect(mockGetNextcloudDownloadUrl).toHaveBeenCalledWith('/root/photo.jpg');
    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith('Erreur lors du téléchargement');
    });
  });

  it('peut utiliser renderHook avec QueryClientProvider pour le hook mocké', () => {
    mockUseNextcloudFolderContents.mockReturnValue({ data: { folders: FOLDERS, files: FILES }, isLoading: false, error: undefined });
    const wrapper = createWrapper();

    const { result } = renderHook(() => (mockUseNextcloudFolderContents as any)('/root'), { wrapper });
    expect(result.current).toEqual({ data: { folders: FOLDERS, files: FILES }, isLoading: false, error: undefined });
  });
});