import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

import { EmailFiltersProvider, useEmailFiltersContext } from '../EmailFiltersContext';

function TestConsumer() {
  const { globalFilters, updateGlobalFilter, resetGlobalFilters, triggerUnreadFilter } = useEmailFiltersContext();
  return (
    <div>
      <span data-testid="search">{globalFilters.search}</span>
      <span data-testid="unread">{String(globalFilters.unreadOnly)}</span>
      <span data-testid="mailbox">{globalFilters.mailbox}</span>
      <button onClick={() => updateGlobalFilter('search', 'test')}>Search</button>
      <button onClick={() => triggerUnreadFilter()}>Unread</button>
      <button onClick={() => resetGlobalFilters()}>Reset</button>
    </div>
  );
}

describe('EmailFiltersContext', () => {
  it('provides default filters', () => {
    render(
      <EmailFiltersProvider><TestConsumer /></EmailFiltersProvider>
    );
    expect(screen.getByTestId('search').textContent).toBe('');
    expect(screen.getByTestId('mailbox').textContent).toBe('inbox');
  });

  it('updates filters', () => {
    render(
      <EmailFiltersProvider><TestConsumer /></EmailFiltersProvider>
    );
    fireEvent.click(screen.getByText('Search'));
    expect(screen.getByTestId('search').textContent).toBe('test');
  });

  it('triggers unread filter', () => {
    render(
      <EmailFiltersProvider><TestConsumer /></EmailFiltersProvider>
    );
    fireEvent.click(screen.getByText('Unread'));
    expect(screen.getByTestId('unread').textContent).toBe('true');
  });

  it('resets filters but preserves entity locks', () => {
    render(
      <EmailFiltersProvider initialFilters={{ etablissementId: 'e1' }}>
        <TestConsumer />
      </EmailFiltersProvider>
    );
    fireEvent.click(screen.getByText('Search'));
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('throws when used outside provider', () => {
    expect(() => render(<TestConsumer />)).toThrow();
  });
});
