import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('@/config/routeLabels', () => ({
  getRouteLabel: (path: string) => path === '/' ? 'Accueil' : path,
}));

import { NavigationHistoryProvider, NavigationHistoryContext } from '../NavigationHistoryContext';

function TestConsumer() {
  const ctx = React.useContext(NavigationHistoryContext);
  const location = useLocation();
  if (!ctx) return <div>No context</div>;
  return (
    <div>
      <span data-testid="count">{ctx.history.length}</span>
      <span data-testid="can-back">{String(ctx.canGoBack)}</span>
      <span data-testid="path">{location.pathname}</span>
    </div>
  );
}

describe('NavigationHistoryContext', () => {
  it('tracks initial route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavigationHistoryProvider>
          <TestConsumer />
        </NavigationHistoryProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
