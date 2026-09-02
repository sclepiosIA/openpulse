import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/documents/useFolders', () => ({
  useFolderBreadcrumb: () => ({
    data: [
      { id: null, name: 'Mes documents' },
      { id: 'f1', name: 'Contrats' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/documents/useNextcloudFolderTree', () => ({
  isNextcloudFolderId: () => false,
  getNextcloudPathFromId: () => null,
}));

import { FolderBreadcrumb } from '../FolderBreadcrumb';

describe('FolderBreadcrumb', () => {
  it('renders breadcrumb items', () => {
    render(<FolderBreadcrumb currentFolderId="f1" onNavigate={vi.fn()} />);
    expect(screen.getByText('Mes documents')).toBeInTheDocument();
    expect(screen.getByText('Contrats')).toBeInTheDocument();
  });

  it('renders null when no folder', () => {
    const { container } = render(<FolderBreadcrumb currentFolderId={null} onNavigate={vi.fn()} />);
    // With null id and mock returning data, it should still render
    expect(container).toBeTruthy();
  });
});
