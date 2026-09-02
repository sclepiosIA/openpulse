import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteFolderDialog } from './DeleteFolderDialog';

const { STABLE_FOLDER, mockUseFolders, mockDeleteFolder, alertDialogState } = vi.hoisted(() => ({
  STABLE_FOLDER: {
    id: 'folder-1',
    name: 'Dossier RH',
    parent_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-02',
  },
  mockUseFolders: vi.fn(),
  mockDeleteFolder: vi.fn(),
  alertDialogState: {
    lastOpen: false as boolean | undefined,
    lastOnOpenChange: undefined as ((open: boolean) => void) | undefined,
  },
}));

vi.mock('@/hooks/documents/useFolders', () => ({
  useFolders: mockUseFolders,
}));

vi.mock('@/components/ui/alert-dialog', () => {
  const ReactModule = React;

  return {
    AlertDialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => {
      alertDialogState.lastOpen = open;
      alertDialogState.lastOnOpenChange = onOpenChange;
      return <div data-testid="alert-dialog-root">{children}</div>;
    },
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog-content">{children}</div>,
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
    AlertDialogAction: ({
      children,
      onClick,
      disabled,
      className,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      className?: string;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled} className={className}>
        {children}
      </button>
    ),
  };
});

describe('DeleteFolderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alertDialogState.lastOpen = false;
    alertDialogState.lastOnOpenChange = undefined;
    mockUseFolders.mockReturnValue({
      deleteFolder: mockDeleteFolder,
      isDeleting: false,
    });
  });

  it('affiche le contenu du dialogue avec le nom du dossier et l’état ouvert', () => {
    const onOpenChange = vi.fn();

    render(
      <DeleteFolderDialog
        folder={STABLE_FOLDER}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(alertDialogState.lastOpen).toBe(true);
    expect(alertDialogState.lastOnOpenChange).toBe(onOpenChange);
    expect(screen.getByText('Supprimer le dossier ?')).toBeInTheDocument();
    expect(
      screen.getByText(/Cette action est irréversible\./)
    ).toHaveTextContent('Le dossier "Dossier RH" et tout son contenu');
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeEnabled();
  });

  it('affiche "Suppression..." et désactive le bouton quand isDeleting est true', () => {
    mockUseFolders.mockReturnValue({
      deleteFolder: mockDeleteFolder,
      isDeleting: true,
    });

    render(
      <DeleteFolderDialog
        folder={STABLE_FOLDER}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Suppression...' });
    expect(deleteButton).toBeDisabled();
  });

  it('appelle deleteFolder avec l’id du dossier et ferme le dialogue en succès puis déclenche onDeleted', () => {
    const onOpenChange = vi.fn();
    const onDeleted = vi.fn();

    mockDeleteFolder.mockImplementation((_folderId: string, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });

    render(
      <DeleteFolderDialog
        folder={STABLE_FOLDER}
        open={true}
        onOpenChange={onOpenChange}
        onDeleted={onDeleted}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    expect(mockDeleteFolder).toHaveBeenCalledTimes(1);
    expect(mockDeleteFolder).toHaveBeenCalledWith(
      'folder-1',
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien si folder est null', () => {
    const onOpenChange = vi.fn();
    const onDeleted = vi.fn();

    render(
      <DeleteFolderDialog
        folder={null}
        open={true}
        onOpenChange={onOpenChange}
        onDeleted={onDeleted}
      />
    );

    expect(screen.getByText(/Le dossier "" et tout son contenu/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    expect(mockDeleteFolder).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('n’appelle pas onOpenChange(false) ni onDeleted si la mutation ne déclenche pas onSuccess', () => {
    const onOpenChange = vi.fn();
    const onDeleted = vi.fn();

    mockDeleteFolder.mockImplementation(() => undefined);

    render(
      <DeleteFolderDialog
        folder={STABLE_FOLDER}
        open={true}
        onOpenChange={onOpenChange}
        onDeleted={onDeleted}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    expect(mockDeleteFolder).toHaveBeenCalledWith(
      'folder-1',
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});