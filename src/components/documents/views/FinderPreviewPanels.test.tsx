import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalDocumentPreviewPanel, LocalFolderPreviewPanel, NextcloudPreviewPanel } from './FinderPreviewPanels';

const { ROWS, mockFrom } = vi.hoisted(() => ({
  ROWS: [{ id: 'row1' }],
  mockFrom: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: ROWS }),
    maybeSingle: vi.fn().mockResolvedValue({ data: ROWS }),
    then: vi.fn().mockResolvedValue({ data: ROWS }),
    catch: vi.fn(),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/components/documents/InlineDocumentPreview', () => ({
  InlineDocumentPreview: ({
    url, mimeType, fileName, loading, onOpenFullPreview,
  }: any) => (
    <div
      data-testid="inline-preview"
      data-url={url}
      data-mimetype={mimeType}
      data-name={fileName}
      data-loading={loading}
      onClick={onOpenFullPreview}
    />
  ),
}));

vi.mock('@/components/documents/finder/ColorTagsBar', () => ({
  ColorTagsBar: ({
    selectedTags, onTagToggle, disabled,
  }: any) => (
    <div data-testid="color-tags" data-selected={selectedTags?.join(',') ?? ''} aria-disabled={disabled} />
  ),
}));

vi.mock('@/components/documents/finder/FinderActionBar', () => ({
  FinderActionBar: (_props: any) => <div data-testid="action-bar" />,
}));

vi.mock('@/lib/safeDate', () => ({
  safeFormat: (date: any, fmt: string, _opts: any) => `formatted(${date},${fmt})`,
  safeFormatDistanceToNow: (date: any, _opts: any) => `dist(${date})`,
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('./FinderColumnView.helpers', () => ({
  formatFileSize: (bytes: number) => `${bytes}B`,
  getFileTypeLabel: (_mime: string) => 'TypeLabel',
}));

vi.mock('@/components/documents/InlineDocumentPreview', () => ({
  InlineDocumentPreview: ({
    url, mimeType, fileName, loading, onOpenFullPreview,
  }: any) => (
    <div
      data-testid="inline-preview"
      data-url={url}
      data-mimetype={mimeType}
      data-name={fileName}
      data-loading={loading}
      onClick={onOpenFullPreview}
    />
  ),
}));

const createWrapper = (children: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('FinderPreviewPanels component suite', () => {
  it('LocalDocumentPreviewPanel renders loading state and basic info', () => {
    const previewDocument = {
      mime_type: 'application/pdf',
      name: 'doc.pdf',
      file_size_bytes: 1234,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: null,
      color_tags: ['tag1', 'tag2'],
    };

    render(
      createWrapper(
        <LocalDocumentPreviewPanel
          previewDocument={previewDocument}
          previewUrl={null}
          loadingPreview={true}
          isTogglingTag={false}
          isDeleting={false}
          onPreview={vi.fn()}
          onDownload={vi.fn()}
          onRename={vi.fn()}
          onCopy={vi.fn()}
          onDelete={vi.fn()}
          onTagToggle={vi.fn()}
        />
      )
    );

    // Inline preview should reflect loading state
    expect(screen.getByTestId('inline-preview')).toBeInTheDocument();
    expect(screen.getByTestId('inline-preview').getAttribute('data-loading')).toBe('true');

    // Name should be rendered
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();

    // Type label from mocked helper
    expect(screen.getByText('TypeLabel')).toBeInTheDocument();

    // File size rendered as mock format
    expect(screen.getByText('1234B')).toBeInTheDocument();
  });

  it('LocalDocumentPreviewPanel shows "Modifié" distance when updated_at is different', () => {
    const previewDocument = {
      mime_type: 'application/pdf',
      name: 'doc2.pdf',
      file_size_bytes: 2048,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      color_tags: [],
    };

    render(
      createWrapper(
        <LocalDocumentPreviewPanel
          previewDocument={previewDocument}
          previewUrl={null}
          loadingPreview={false}
          isTogglingTag={false}
          isDeleting={false}
          onPreview={vi.fn()}
          onDownload={vi.fn()}
          onRename={vi.fn()}
          onCopy={vi.fn()}
          onDelete={vi.fn()}
          onTagToggle={vi.fn()}
        />
      )
    );

    // Ensure created date formatting appears
    expect(screen.getByText('formatted(2023-01-01T00:00:00Z,dd MMM yyyy)')).toBeInTheDocument();

    // Ensure modified distance is shown
    expect(screen.getByText('dist(2023-01-02T00:00:00Z)')).toBeInTheDocument();
  });

  it('NextcloudPreviewPanel renders file info and modifié row when lastModified exists', () => {
    const previewNextcloudFile = {
      name: 'ncfile.txt',
      mimeType: 'text/plain',
      size: 4096,
      lastModified: '2023-01-03T12:00:00Z',
    };

    render(
      createWrapper(
        <NextcloudPreviewPanel
          previewNextcloudFile={previewNextcloudFile as any}
          ncPreviewUrl={null}
          ncPreviewLoading={false}
          onDownload={vi.fn()}
          onCopy={vi.fn()}
        />
      )
    );

    // Name and Nextcloud label
    expect(screen.getByText('ncfile.txt')).toBeInTheDocument();
    expect(screen.getByText('Fichier Nextcloud')).toBeInTheDocument();

    // Size formatting
    expect(screen.getByText('4096B')).toBeInTheDocument();

    // Modified date formatted
    expect(screen.getByText('formatted(2023-01-03T12:00:00Z,dd MMM yyyy)')).toBeInTheDocument();
  });
});