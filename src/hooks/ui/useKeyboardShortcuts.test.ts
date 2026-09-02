import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useKeyboardShortcuts, useNavigationShortcuts } from './useKeyboardShortcuts';

const { cbCtrlK, cbAltShiftX, cbPlainA, cbDup1, cbDup2, SHORTCUTS, SHORTCUTS_DUP, TABS, setActive } = vi.hoisted(() => {
  const cbCtrlK = vi.fn();
  const cbAltShiftX = vi.fn();
  const cbPlainA = vi.fn();
  const cbDup1 = vi.fn();
  const cbDup2 = vi.fn();
  const SHORTCUTS = [
    { key: 'k', ctrl: true, description: 'Ctrl+K', callback: cbCtrlK },
    { key: 'x', alt: true, shift: true, description: 'Alt+Shift+X', callback: cbAltShiftX },
    { key: 'a', description: 'A', callback: cbPlainA },
  ];
  const SHORTCUTS_DUP = [
    { key: 'k', ctrl: true, description: 'First duplicate', callback: cbDup1 },
    { key: 'k', ctrl: true, description: 'Second duplicate', callback: cbDup2 },
  ];
  const TABS = ['home', 'search', 'settings'];
  const setActive = vi.fn();
  return { cbCtrlK, cbAltShiftX, cbPlainA, cbDup1, cbDup2, SHORTCUTS, SHORTCUTS_DUP, TABS, setActive };
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls callback for ctrl-specified shortcut when Ctrl is pressed and prevents default', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() => useKeyboardShortcuts(SHORTCUTS), { wrapper });

    const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(ev);

    expect(cbCtrlK).toHaveBeenCalledTimes(1);
    expect(cbAltShiftX).not.toHaveBeenCalled();
    expect(cbPlainA).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(true);

    unmount();
  });

  it('calls callback for ctrl-specified shortcut when Meta is pressed (macOS) and prevents default', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() => useKeyboardShortcuts(SHORTCUTS), { wrapper });

    const ev = new KeyboardEvent('keydown', { key: 'K', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, cancelable: true });
    document.dispatchEvent(ev);

    expect(cbCtrlK).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);

    unmount();
  });

  it('calls callback for Alt+Shift shortcut only when both modifiers are pressed and prevents default', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() => useKeyboardShortcuts(SHORTCUTS), { wrapper });

    const ev = new KeyboardEvent('keydown', { key: 'x', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(ev);
    expect(cbAltShiftX).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);

    const evAltOnly = new KeyboardEvent('keydown', { key: 'x', altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(evAltOnly);
    expect(cbAltShiftX).toHaveBeenCalledTimes(1);

    const evShiftOnly = new KeyboardEvent('keydown', { key: 'x', altKey: false, shiftKey: true, ctrlKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(evShiftOnly);
    expect(cbAltShiftX).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('calls callback for plain key only when no modifiers are pressed', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() => useKeyboardShortcuts(SHORTCUTS), { wrapper });

    const ev = new KeyboardEvent('keydown', { key: 'a', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(ev);
    expect(cbPlainA).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);

    const evWithCtrl = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(evWithCtrl);
    expect(cbPlainA).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('executes only the first matching shortcut when multiple match', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() => useKeyboardShortcuts(SHORTCUTS_DUP), { wrapper });

    const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(ev);

    expect(cbDup1).toHaveBeenCalledTimes(1);
    expect(cbDup2).not.toHaveBeenCalled();

    unmount();
  });

  it('removes event listener on unmount', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() => useKeyboardShortcuts(SHORTCUTS), { wrapper });

    unmount();

    const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(ev);

    expect(cbCtrlK).not.toHaveBeenCalled();
  });
});

describe('useNavigationShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to tab via Alt + number', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() => useNavigationShortcuts(TABS, 'home', setActive), { wrapper });

    const ev = new KeyboardEvent('keydown', { key: '2', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(ev);

    expect(setActive).toHaveBeenCalledTimes(1);
    expect(setActive).toHaveBeenCalledWith('search');
    expect(ev.defaultPrevented).toBe(true);

    unmount();
  });

  it('navigates to next tab with Ctrl+Tab and wraps around', () => {
    const wrapper = createWrapper();

    const r1 = renderHook(() => useNavigationShortcuts(TABS, 'home', setActive), { wrapper });
    const ev1 = new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(ev1);
    expect(setActive).toHaveBeenCalledWith('search');
    expect(ev1.defaultPrevented).toBe(true);
    r1.unmount();

    vi.clearAllMocks();

    const r2 = renderHook(() => useNavigationShortcuts(TABS, 'settings', setActive), { wrapper });
    const ev2 = new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(ev2);
    expect(setActive).toHaveBeenCalledWith('home');
    expect(ev2.defaultPrevented).toBe(true);
    r2.unmount();
  });

  it('navigates to previous tab with Ctrl+Shift+Tab and wraps to last when at start', () => {
    const wrapper = createWrapper();

    const { unmount } = renderHook(() => useNavigationShortcuts(TABS, 'home', setActive), { wrapper });
    const ev = new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(ev);
    expect(setActive).toHaveBeenCalledWith('settings');
    expect(ev.defaultPrevented).toBe(true);
    unmount();
  });

  it('supports Meta+Tab for next navigation (macOS)', () => {
    const wrapper = createWrapper();

    const { unmount } = renderHook(() => useNavigationShortcuts(TABS, 'search', setActive), { wrapper });
    const ev = new KeyboardEvent('keydown', { key: 'Tab', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, cancelable: true });
    document.dispatchEvent(ev);
    expect(setActive).toHaveBeenCalledWith('settings');
    expect(ev.defaultPrevented).toBe(true);
    unmount();
  });

  it('removes event listener on unmount for navigation shortcuts', () => {
    const wrapper = createWrapper();
    const { unmount } = renderHook(() => useNavigationShortcuts(TABS, 'home', setActive), { wrapper });

    unmount();

    const ev = new KeyboardEvent('keydown', { key: '1', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, cancelable: true });
    document.dispatchEvent(ev);

    expect(setActive).not.toHaveBeenCalled();
  });
});