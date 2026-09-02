import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailThreadKeyboard } from './useEmailThreadKeyboard';

const {
  onReply,
  onReplyAll,
  onArchive,
  onForward,
  onExpandAll,
  onCollapseAll,
  onNextMessage,
  onPreviousMessage,
  onToggleSelection,
  onShowShortcuts,
} = vi.hoisted(() => ({
  onReply: vi.fn(),
  onReplyAll: vi.fn(),
  onArchive: vi.fn(),
  onForward: vi.fn(),
  onExpandAll: vi.fn(),
  onCollapseAll: vi.fn(),
  onNextMessage: vi.fn(),
  onPreviousMessage: vi.fn(),
  onToggleSelection: vi.fn(),
  onShowShortcuts: vi.fn(),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  onReply.mockReset();
  onReplyAll.mockReset();
  onArchive.mockReset();
  onForward.mockReset();
  onExpandAll.mockReset();
  onCollapseAll.mockReset();
  onNextMessage.mockReset();
  onPreviousMessage.mockReset();
  onToggleSelection.mockReset();
  onShowShortcuts.mockReset();
});

describe('useEmailThreadKeyboard', () => {
  it('triggers onReply on "r" without modifiers and prevents default', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onReply }),
      { wrapper }
    );

    const ev = new KeyboardEvent('keydown', { key: 'r', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);

    expect(onReply).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);

    unmount();
  });

  it('triggers onReplyAll on "R" with shift when onReply is not provided', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onReplyAll }),
      { wrapper }
    );

    const ev = new KeyboardEvent('keydown', { key: 'R', shiftKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);

    expect(onReplyAll).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);

    unmount();
  });

  it('does not trigger when disabled is true', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onArchive, disabled: true }),
      { wrapper }
    );

    const ev = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);

    expect(onArchive).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);

    unmount();
  });

  it('does not trigger when a modifier key (ctrl/meta/alt) is pressed', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onArchive }),
      { wrapper }
    );

    const ev1 = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true });
    const ev2 = new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true, cancelable: true });
    const ev3 = new KeyboardEvent('keydown', { key: 'a', altKey: true, bubbles: true, cancelable: true });

    document.body.dispatchEvent(ev1);
    document.body.dispatchEvent(ev2);
    document.body.dispatchEvent(ev3);

    expect(onArchive).not.toHaveBeenCalled();
    expect(ev1.defaultPrevented).toBe(false);
    expect(ev2.defaultPrevented).toBe(false);
    expect(ev3.defaultPrevented).toBe(false);

    unmount();
  });

  it('does not trigger when typing in input/textarea/select', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onReply }),
      { wrapper }
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    const evInput = new KeyboardEvent('keydown', { key: 'r', bubbles: true, cancelable: true });
    input.dispatchEvent(evInput);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const evTextarea = new KeyboardEvent('keydown', { key: 'r', bubbles: true, cancelable: true });
    textarea.dispatchEvent(evTextarea);

    const select = document.createElement('select');
    document.body.appendChild(select);
    const evSelect = new KeyboardEvent('keydown', { key: 'r', bubbles: true, cancelable: true });
    select.dispatchEvent(evSelect);

    expect(onReply).not.toHaveBeenCalled();
    expect(evInput.defaultPrevented).toBe(false);
    expect(evTextarea.defaultPrevented).toBe(false);
    expect(evSelect.defaultPrevented).toBe(false);

    unmount();
    input.remove();
    textarea.remove();
    select.remove();
  });

  it('does not trigger when target is contentEditable or role="textbox" or inside .ProseMirror', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onForward }),
      { wrapper }
    );

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    const evEditable = new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true });
    editable.dispatchEvent(evEditable);

    const roleTextbox = document.createElement('div');
    roleTextbox.setAttribute('role', 'textbox');
    document.body.appendChild(roleTextbox);
    const evRoleTextbox = new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true });
    roleTextbox.dispatchEvent(evRoleTextbox);

    const prose = document.createElement('div');
    prose.className = 'ProseMirror';
    const child = document.createElement('span');
    prose.appendChild(child);
    document.body.appendChild(prose);
    const evProseChild = new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true });
    child.dispatchEvent(evProseChild);

    expect(onForward).not.toHaveBeenCalled();
    expect(evEditable.defaultPrevented).toBe(false);
    expect(evRoleTextbox.defaultPrevented).toBe(false);
    expect(evProseChild.defaultPrevented).toBe(false);

    unmount();
    editable.remove();
    roleTextbox.remove();
    prose.remove();
  });

  it('triggers onExpandAll on "e" key', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onExpandAll }),
      { wrapper }
    );

    const ev = new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);

    expect(onExpandAll).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);

    unmount();
  });

  it('triggers onCollapseAll on "c" key', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onCollapseAll }),
      { wrapper }
    );

    const ev = new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);

    expect(onCollapseAll).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);

    unmount();
  });

  it('triggers onNextMessage on "j" and onPreviousMessage on "k"', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onNextMessage, onPreviousMessage }),
      { wrapper }
    );

    const evJ = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true });
    document.body.dispatchEvent(evJ);
    expect(onNextMessage).toHaveBeenCalledTimes(1);
    expect(evJ.defaultPrevented).toBe(true);

    const evK = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true });
    document.body.dispatchEvent(evK);
    expect(onPreviousMessage).toHaveBeenCalledTimes(1);
    expect(evK.defaultPrevented).toBe(true);

    unmount();
  });

  it('triggers onToggleSelection on "x"', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onToggleSelection }),
      { wrapper }
    );

    const ev = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);

    expect(onToggleSelection).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);

    unmount();
  });

  it('triggers onShowShortcuts on "?"', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onShowShortcuts }),
      { wrapper }
    );

    const ev = new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);

    expect(onShowShortcuts).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);

    unmount();
  });

  it('removes listener on unmount', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() =>
      useEmailThreadKeyboard({ onArchive }),
      { wrapper }
    );

    const ev1 = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev1);
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(ev1.defaultPrevented).toBe(true);

    onArchive.mockClear();
    unmount();

    const ev2 = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev2);
    expect(onArchive).not.toHaveBeenCalled();
    expect(ev2.defaultPrevented).toBe(false);
  });
});