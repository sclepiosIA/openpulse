import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PageHeaderSlotProvider, usePageHeaderSlot } from '../PageHeaderSlotContext';

function TestConsumer() {
  const { headerContent, setHeaderContent } = usePageHeaderSlot();
  return (
    <div>
      <div data-testid="slot">{headerContent}</div>
      <button onClick={() => setHeaderContent(<span>Custom Header</span>)}>Set</button>
      <button onClick={() => setHeaderContent(null)}>Clear</button>
    </div>
  );
}

describe('PageHeaderSlotContext', () => {
  it('defaults to null', () => {
    render(
      <PageHeaderSlotProvider><TestConsumer /></PageHeaderSlotProvider>
    );
    expect(screen.getByTestId('slot').children.length).toBe(0);
  });

  it('sets and clears header content', () => {
    render(
      <PageHeaderSlotProvider><TestConsumer /></PageHeaderSlotProvider>
    );
    fireEvent.click(screen.getByText('Set'));
    expect(screen.getByText('Custom Header')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.queryByText('Custom Header')).toBeNull();
  });
});
