import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MobileDrawerProvider, useMobileDrawer } from '../MobileDrawerContext';

function TestConsumer() {
  const { isOpen, open, close, toggle } = useMobileDrawer();
  return (
    <div>
      <span data-testid="state">{String(isOpen)}</span>
      <button onClick={open}>Open</button>
      <button onClick={close}>Close</button>
      <button onClick={toggle}>Toggle</button>
    </div>
  );
}

describe('MobileDrawerContext', () => {
  it('defaults to closed', () => {
    render(
      <MobileDrawerProvider><TestConsumer /></MobileDrawerProvider>
    );
    expect(screen.getByTestId('state').textContent).toBe('false');
  });

  it('opens and closes', () => {
    render(
      <MobileDrawerProvider><TestConsumer /></MobileDrawerProvider>
    );
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('state').textContent).toBe('true');
    fireEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('state').textContent).toBe('false');
  });

  it('toggles', () => {
    render(
      <MobileDrawerProvider><TestConsumer /></MobileDrawerProvider>
    );
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('state').textContent).toBe('true');
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('state').textContent).toBe('false');
  });
});
