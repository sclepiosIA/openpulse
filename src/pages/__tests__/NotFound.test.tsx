import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

describe('NotFound', () => {
  const renderNotFound = async (path = '/unknown') => {
    const NotFound = (await import('@/pages/NotFound')).default;
    return render(
      React.createElement(MemoryRouter, { initialEntries: [path] },
        React.createElement(NotFound)
      )
    );
  };

  it('should render 404 heading', async () => {
    await renderNotFound();
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('should render error message', async () => {
    await renderNotFound();
    expect(screen.getByText('Oups ! Page introuvable')).toBeInTheDocument();
  });

  it('should render home link', async () => {
    await renderNotFound();
    const link = screen.getByText("Retour à l'accueil");
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/');
  });

  it('should log error with path', async () => {
    const { debug } = await import('@/lib/debug');
    await renderNotFound('/some/bad/path');
    expect(debug.error).toHaveBeenCalledWith(
      '404 Error: User attempted to access non-existent route:',
      expect.any(String)
    );
  });
});
