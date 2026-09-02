import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/shared/useVirtualBreadcrumb', () => ({
  useVirtualBreadcrumb: () => ({
    pushBreadcrumb: vi.fn(),
    popBreadcrumb: vi.fn(),
    pushEntry: vi.fn(),
    popEntry: vi.fn(),
  }),
}));

import { EmailProvider, useEmailContext, useEmailState, useEmailActions } from '../EmailContext';

function TestConsumer() {
  const { state, actions } = useEmailContext();
  return (
    <div>
      <span data-testid="selected">{state.selectedThread || 'none'}</span>
      <span data-testid="composing">{String(state.composing)}</span>
      <span data-testid="account">{state.accountId}</span>
      <button onClick={() => actions.selectThread('t1')}>Select</button>
      <button onClick={() => actions.startComposing()}>Compose</button>
      <button onClick={() => actions.goBack()}>Back</button>
      <button onClick={() => actions.changeAccount('a2')}>ChangeAccount</button>
    </div>
  );
}

function StateConsumer() {
  const state = useEmailState();
  return <span data-testid="state-selected">{state.selectedThread || 'none'}</span>;
}

function ActionsConsumer() {
  const actions = useEmailActions();
  return <button onClick={() => actions.selectThread('t2')}>SelectT2</button>;
}

describe('EmailContext', () => {
  const defaultProps = {
    initialAccountId: 'a1',
    onRefresh: vi.fn().mockResolvedValue(undefined),
  };

  it('provides initial state', () => {
    render(
      <EmailProvider {...defaultProps}><TestConsumer /></EmailProvider>
    );
    expect(screen.getByTestId('selected').textContent).toBe('none');
    expect(screen.getByTestId('composing').textContent).toBe('false');
    expect(screen.getByTestId('account').textContent).toBe('a1');
  });

  it('selects thread', () => {
    render(
      <EmailProvider {...defaultProps}><TestConsumer /></EmailProvider>
    );
    fireEvent.click(screen.getByText('Select'));
    expect(screen.getByTestId('selected').textContent).toBe('t1');
  });

  it('starts composing', () => {
    render(
      <EmailProvider {...defaultProps}><TestConsumer /></EmailProvider>
    );
    fireEvent.click(screen.getByText('Compose'));
    expect(screen.getByTestId('composing').textContent).toBe('true');
  });

  it('goes back', () => {
    render(
      <EmailProvider {...defaultProps}><TestConsumer /></EmailProvider>
    );
    fireEvent.click(screen.getByText('Select'));
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByTestId('selected').textContent).toBe('none');
  });

  it('changes account', () => {
    render(
      <EmailProvider {...defaultProps}><TestConsumer /></EmailProvider>
    );
    fireEvent.click(screen.getByText('ChangeAccount'));
    expect(screen.getByTestId('account').textContent).toBe('a2');
  });

  it('useEmailState provides state', () => {
    render(
      <EmailProvider {...defaultProps}><StateConsumer /></EmailProvider>
    );
    expect(screen.getByTestId('state-selected').textContent).toBe('none');
  });

  it('throws when used outside provider', () => {
    expect(() => render(<TestConsumer />)).toThrow();
  });
});
