import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { JarvisConversationProvider, useJarvisConversation, useJarvisConversationOptional } from '../JarvisConversationContext';

function TestConsumer() {
  const { messages, setMessages, clearMessages, isTyping, setIsTyping, streamState, resetStreamState } = useJarvisConversation();
  return (
    <div>
      <span data-testid="count">{messages.length}</span>
      <span data-testid="typing">{String(isTyping)}</span>
      <span data-testid="streaming">{String(streamState.isStreaming)}</span>
      <button onClick={() => setMessages([{ id: '1', role: 'user', content: 'Hello' } as any])}>Add</button>
      <button onClick={clearMessages}>Clear</button>
      <button onClick={() => setIsTyping(true)}>Type</button>
      <button onClick={resetStreamState}>ResetStream</button>
    </div>
  );
}

function OptionalConsumer() {
  const ctx = useJarvisConversationOptional();
  return <span data-testid="optional">{ctx ? 'yes' : 'no'}</span>;
}

describe('JarvisConversationContext', () => {
  it('provides initial state', () => {
    render(
      <JarvisConversationProvider><TestConsumer /></JarvisConversationProvider>
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('typing').textContent).toBe('false');
    expect(screen.getByTestId('streaming').textContent).toBe('false');
  });

  it('manages messages', () => {
    render(
      <JarvisConversationProvider><TestConsumer /></JarvisConversationProvider>
    );
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('manages typing state', () => {
    render(
      <JarvisConversationProvider><TestConsumer /></JarvisConversationProvider>
    );
    fireEvent.click(screen.getByText('Type'));
    expect(screen.getByTestId('typing').textContent).toBe('true');
  });

  it('throws when used outside provider', () => {
    expect(() => render(<TestConsumer />)).toThrow();
  });

  it('optional hook returns null outside provider', () => {
    render(<OptionalConsumer />);
    expect(screen.getByTestId('optional').textContent).toBe('no');
  });
});
