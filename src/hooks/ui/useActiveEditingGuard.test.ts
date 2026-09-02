// @vitest-environment jsdom

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActiveEditingGuard } from './useActiveEditingGuard';

const { storageState, mockSafeStorage } = vi.hoisted(() => {
  const state = new Map<string, string>();

  return {
    storageState: state,
    mockSafeStorage: {
      getItem: vi.fn((key: string) => (state.has(key) ? state.get(key) ?? null : null)),
      setItem: vi.fn((key: string, value: string) => {
        state.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        state.delete(key);
      }),
    },
  };
});

vi.mock('@/lib/safeStorage', () => ({
  safeStorage: mockSafeStorage,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useActiveEditingGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T10:00:00.000Z'));
    storageState.clear();
    mockSafeStorage.getItem.mockClear();
    mockSafeStorage.setItem.mockClear();
    mockSafeStorage.removeItem.mockClear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('marks editing active on editable input events and clears flag on unmount', async () => {
    const wrapper = createWrapper();
    const input = document.createElement('input');
    document.body.appendChild(input);

    const { unmount } = renderHook(() => useActiveEditingGuard(), { wrapper });

    await act(async () => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(mockSafeStorage.setItem).toHaveBeenCalledWith('app-last-input-at', String(Date.now()));
    expect(mockSafeStorage.setItem).toHaveBeenCalledWith('app-editing-active', '1');
    expect(storageState.get('app-last-input-at')).toBe(String(Date.now()));
    expect(storageState.get('app-editing-active')).toBe('1');

    unmount();

    expect(mockSafeStorage.removeItem).toHaveBeenCalledWith('app-editing-active');
    expect(storageState.has('app-editing-active')).toBe(false);
  });

  it('ignores non-editable targets', async () => {
    const wrapper = createWrapper();
    const div = document.createElement('div');
    document.body.appendChild(div);

    renderHook(() => useActiveEditingGuard(), { wrapper });

    await act(async () => {
      div.dispatchEvent(new Event('keydown', { bubbles: true }));
      div.dispatchEvent(new Event('beforeinput', { bubbles: true }));
    });

    expect(mockSafeStorage.setItem).not.toHaveBeenCalled();
    expect(storageState.has('app-editing-active')).toBe(false);
    expect(storageState.has('app-last-input-at')).toBe(false);
  });

  it('detects contenteditable descendants via selectionchange', async () => {
    const wrapper = createWrapper();

    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const textNode = document.createTextNode('hello');
    editor.appendChild(textNode);
    document.body.appendChild(editor);

    const getSelectionSpy = vi.spyOn(document, 'getSelection').mockReturnValue({
      anchorNode: textNode,
    } as Selection);

    renderHook(() => useActiveEditingGuard(), { wrapper });

    await act(async () => {
      document.dispatchEvent(new Event('selectionchange'));
    });

    expect(mockSafeStorage.setItem).toHaveBeenCalledWith('app-last-input-at', String(Date.now()));
    expect(mockSafeStorage.setItem).toHaveBeenCalledWith('app-editing-active', '1');
    expect(storageState.get('app-editing-active')).toBe('1');

    getSelectionSpy.mockRestore();
  });

  it('marks editing active when event target is inside a contenteditable ancestor', async () => {
    const wrapper = createWrapper();

    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const child = document.createElement('span');
    editor.appendChild(child);
    document.body.appendChild(editor);

    renderHook(() => useActiveEditingGuard(), { wrapper });

    await act(async () => {
      child.dispatchEvent(new Event('beforeinput', { bubbles: true }));
    });

    expect(mockSafeStorage.setItem).toHaveBeenCalledWith('app-last-input-at', String(Date.now()));
    expect(mockSafeStorage.setItem).toHaveBeenCalledWith('app-editing-active', '1');
    expect(storageState.get('app-editing-active')).toBe('1');
  });

  it('clears stale editing flag after active window expires', async () => {
    const wrapper = createWrapper();

    storageState.set('app-last-input-at', String(Date.now() - (2 * 60 * 1000 + 1)));
    storageState.set('app-editing-active', '1');

    renderHook(() => useActiveEditingGuard(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(mockSafeStorage.getItem).toHaveBeenCalledWith('app-last-input-at');
    expect(mockSafeStorage.removeItem).toHaveBeenCalledWith('app-editing-active');
    expect(storageState.has('app-editing-active')).toBe(false);
  });

  it('keeps editing flag when last input is still within active window', async () => {
    const wrapper = createWrapper();

    storageState.set('app-last-input-at', String(Date.now() - 60_000));
    storageState.set('app-editing-active', '1');

    renderHook(() => useActiveEditingGuard(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(mockSafeStorage.getItem).toHaveBeenCalledWith('app-last-input-at');
    expect(storageState.get('app-editing-active')).toBe('1');
    expect(mockSafeStorage.removeItem).not.toHaveBeenCalledWith('app-editing-active');
  });
});