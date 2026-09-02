import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../confirm-dialog';

describe('ConfirmDialog — userEvent flow critique (destructive)', () => {
  it('clic sur Confirmer destructive → onConfirm appelé une fois', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Supprimer le prospect"
        description="Cette action est irréversible."
        variant="destructive"
        confirmText="Supprimer définitivement"
        onConfirm={onConfirm}
      />,
    );

    const confirmBtn = await screen.findByRole('button', { name: /supprimer définitivement/i });
    await user.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('clic sur Annuler → onConfirm NON appelé, onOpenChange(false) déclenché', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Supprimer"
        description="Confirmation requise."
        onConfirm={onConfirm}
      />,
    );

    const cancelBtn = await screen.findByRole('button', { name: /annuler/i });
    await user.click(cancelBtn);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('loading=true → boutons désactivés, clic Confirmer ignoré', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Suppression en cours"
        description="Veuillez patienter."
        loading
        onConfirm={onConfirm}
      />,
    );

    const confirmBtn = await screen.findByRole('button', { name: /confirmer/i });
    expect(confirmBtn).toBeDisabled();
    await user.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
