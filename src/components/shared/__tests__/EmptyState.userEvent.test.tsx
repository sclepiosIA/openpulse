import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '../EmptyState';

describe('EmptyState — userEvent flow critique (action principale + secondaire)', () => {
  it('clic sur action principale → callback appelé 1×', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        type="empty"
        title="Aucun prospect"
        description="Commencez par créer un prospect."
        action={{ label: 'Créer un prospect', onClick }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /créer un prospect/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('clic sur action secondaire → callback secondaire appelé, principal NON', async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <EmptyState
        type="not-configured"
        title="Pas de compte email"
        description="Configurez un compte IMAP."
        action={{ label: 'Configurer', onClick: onPrimary }}
        secondaryAction={{ label: 'Voir la documentation', onClick: onSecondary }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /voir la documentation/i }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(onPrimary).not.toHaveBeenCalled();
  });
});
