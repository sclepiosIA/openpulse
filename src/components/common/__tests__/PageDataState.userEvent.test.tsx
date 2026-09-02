import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PageDataState } from '../PageDataState';

describe('PageDataState — userEvent flow critique (retry)', () => {
  it('état error → clic Réessayer appelle onRetry exactement 1×', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <PageDataState
          isLoading={false}
          isError={true}
          error={new Error('Network down')}
          onRetry={onRetry}
        >
          <div>contenu</div>
        </PageDataState>
      </MemoryRouter>,
    );

    const retryBtn = await screen.findByRole('button', { name: /réessayer/i });
    await user.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('état error RLS deny (Auth) → pas de bouton Réessayer (uniquement Retour accueil)', async () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <PageDataState
          isLoading={false}
          isError={true}
          error={new Error('permission denied for table foo')}
          onRetry={onRetry}
        >
          <div>contenu</div>
        </PageDataState>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /réessayer/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /retour à l'accueil/i })).toBeInTheDocument();
  });
});
