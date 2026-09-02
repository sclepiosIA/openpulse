import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisKeyboardShortcuts } from './useJarvisKeyboardShortcuts';

const {
  onToggle,
  onClose,
  onVoiceMode,
  onCommandPalette,
  onQuickAction,
} = vi.hoisted(() => ({
  onToggle: vi.fn(),
  onClose: vi.fn(),
  onVoiceMode: vi.fn(),
  onCommandPalette: vi.fn(),
  onQuickAction: vi.fn(),
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper(props: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(QueryClientProvider, { client: qc }, props.children);
  };
}

describe('useJarvisKeyboardShortcuts', () => {
  beforeEach(() => {
    onToggle.mockClear();
    onClose.mockClear();
    onVoiceMode.mockClear();
    onCommandPalette.mockClear();
    onQuickAction.mockClear();
  });

  it('exposes the expected shortcuts array with correct metadata and actions', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          isOpen: false,
          onToggle,
          onClose,
          onVoiceMode,
          onCommandPalette,
          onQuickAction,
        }),
      { wrapper },
    );

    const { shortcuts } = result.current;
    expect(Array.isArray(shortcuts)).toBe(true);
    expect(shortcuts.length).toBe(5);

    const findByDescription = (desc: string) => shortcuts.find((s) => s.description === desc);

    const openClose = findByDescription('Ouvrir/Fermer Jarvis');
    expect(openClose).toBeDefined();
    const oc = openClose as NonNullable<typeof openClose>;
    expect(oc.key).toBe('J');
    expect(oc.modifiers).toEqual(['meta']);
    oc.action();
    expect(onToggle).toHaveBeenCalledTimes(1);

    const voice = findByDescription('Mode vocal');
    expect(voice).toBeDefined();
    const v = voice as NonNullable<typeof voice>;
    expect(v.key).toBe('J');
    expect(v.modifiers).toEqual(['meta', 'shift']);
    v.action();
    expect(onVoiceMode).toHaveBeenCalledTimes(1);

    const palette = findByDescription('Palette de commandes');
    expect(palette).toBeDefined();
    const p = palette as NonNullable<typeof palette>;
    expect(p.key).toBe('K');
    expect(p.modifiers).toEqual(['meta']);
    p.action();
    expect(onCommandPalette).toHaveBeenCalledTimes(1);

    const quick = findByDescription('Action rapide');
    expect(quick).toBeDefined();
    const q = quick as NonNullable<typeof quick>;
    expect(q.key).toBe('.');
    expect(q.modifiers).toEqual(['meta']);
    q.action();
    expect(onQuickAction).toHaveBeenCalledTimes(1);

    const close = findByDescription('Fermer');
    expect(close).toBeDefined();
    const c = close as NonNullable<typeof close>;
    expect(c.key).toBe('Escape');
    expect(c.modifiers).toEqual([]);
    c.action();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onToggle when Cmd/Ctrl+J is pressed and prevents default', () => {
    const wrapper = createWrapper();
    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          isOpen: false,
          onToggle,
          onClose,
        }),
      { wrapper },
    );

    const evt = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true });
    const pd = vi.fn();
    Object.defineProperty(evt, 'preventDefault', { value: pd });

    act(() => {
      document.dispatchEvent(evt);
    });

    expect(pd).toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onVoiceMode for Cmd/Ctrl+Shift+J and does not call onToggle', () => {
    const wrapper = createWrapper();
    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          isOpen: false,
          onToggle,
          onClose,
          onVoiceMode,
        }),
      { wrapper },
    );

    const evt = new KeyboardEvent('keydown', { key: 'J', ctrlKey: true, shiftKey: true, bubbles: true });
    const pd = vi.fn();
    Object.defineProperty(evt, 'preventDefault', { value: pd });

    act(() => {
      document.dispatchEvent(evt);
    });

    expect(pd).toHaveBeenCalled();
    expect(onVoiceMode).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('calls onCommandPalette for Cmd/Ctrl+K', () => {
    const wrapper = createWrapper();
    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          isOpen: false,
          onToggle,
          onClose,
          onCommandPalette,
        }),
      { wrapper },
    );

    const evt = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
    const pd = vi.fn();
    Object.defineProperty(evt, 'preventDefault', { value: pd });

    act(() => {
      document.dispatchEvent(evt);
    });

    expect(pd).toHaveBeenCalled();
    expect(onCommandPalette).toHaveBeenCalledTimes(1);
  });

  it('calls onQuickAction for Cmd/Ctrl+.', () => {
    const wrapper = createWrapper();
    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          isOpen: false,
          onToggle,
          onClose,
          onQuickAction,
        }),
      { wrapper },
    );

    const evt = new KeyboardEvent('keydown', { key: '.', ctrlKey: true, bubbles: true });
    const pd = vi.fn();
    Object.defineProperty(evt, 'preventDefault', { value: pd });

    act(() => {
      document.dispatchEvent(evt);
    });

    expect(pd).toHaveBeenCalled();
    expect(onQuickAction).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed only if isOpen is true', () => {
    const wrapper = createWrapper();
    const { rerender } = renderHook(
      (props: { isOpen: boolean }) =>
        useJarvisKeyboardShortcuts({
          isOpen: props.isOpen,
          onToggle,
          onClose,
        }),
      {
        wrapper,
        initialProps: { isOpen: false },
      },
    );

    // Escape when closed -> should not call
    let evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    let pd = vi.fn();
    Object.defineProperty(evt, 'preventDefault', { value: pd });

    act(() => {
      document.dispatchEvent(evt);
    });

    expect(pd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // Rerender with isOpen true
    rerender({ isOpen: true });

    evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    pd = vi.fn();
    Object.defineProperty(evt, 'preventDefault', { value: pd });

    act(() => {
      document.dispatchEvent(evt);
    });

    expect(pd).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does nothing when shortcuts are disabled via enabled=false', () => {
    const wrapper = createWrapper();
    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          isOpen: false,
          onToggle,
          onClose,
          enabled: false,
        }),
      { wrapper },
    );

    const evt = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true });
    const pd = vi.fn();
    Object.defineProperty(evt, 'preventDefault', { value: pd });

    act(() => {
      document.dispatchEvent(evt);
    });

    expect(pd).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('removes the event listener on unmount', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          isOpen: false,
          onToggle,
          onClose,
        }),
      { wrapper },
    );

    unmount();

    const evt = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true });
    const pd = vi.fn();
    Object.defineProperty(evt, 'preventDefault', { value: pd });

    act(() => {
      document.dispatchEvent(evt);
    });

    expect(pd).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
  });
});