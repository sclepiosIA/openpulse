import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts, useNavigationShortcuts } from '../ui/useKeyboardShortcuts';

describe('useKeyboardShortcuts extended', () => {
  const fireKey = (key: string, opts: Partial<KeyboardEventInit> = {}) => {
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
    });
  };

  describe('useKeyboardShortcuts', () => {
    it('fires callback on matching key', () => {
      const cb = vi.fn();
      renderHook(() => useKeyboardShortcuts([{ key: 'k', description: 'test', callback: cb }]));
      fireKey('k');
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('ignores non-matching key', () => {
      const cb = vi.fn();
      renderHook(() => useKeyboardShortcuts([{ key: 'k', description: 'test', callback: cb }]));
      fireKey('j');
      expect(cb).not.toHaveBeenCalled();
    });

    it('requires ctrl when specified', () => {
      const cb = vi.fn();
      renderHook(() => useKeyboardShortcuts([{ key: 'k', ctrl: true, description: 'test', callback: cb }]));
      fireKey('k'); // no ctrl
      expect(cb).not.toHaveBeenCalled();
      fireKey('k', { ctrlKey: true });
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('requires alt when specified', () => {
      const cb = vi.fn();
      renderHook(() => useKeyboardShortcuts([{ key: 'a', alt: true, description: 'test', callback: cb }]));
      fireKey('a');
      expect(cb).not.toHaveBeenCalled();
      fireKey('a', { altKey: true });
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('requires shift when specified', () => {
      const cb = vi.fn();
      renderHook(() => useKeyboardShortcuts([{ key: 's', shift: true, description: 'test', callback: cb }]));
      fireKey('s');
      expect(cb).not.toHaveBeenCalled();
      fireKey('s', { shiftKey: true });
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('handles multiple shortcuts', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      renderHook(() => useKeyboardShortcuts([
        { key: 'a', description: 'a', callback: cb1 },
        { key: 'b', description: 'b', callback: cb2 },
      ]));
      fireKey('a');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).not.toHaveBeenCalled();
      fireKey('b');
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('cleans up on unmount', () => {
      const cb = vi.fn();
      const { unmount } = renderHook(() => useKeyboardShortcuts([{ key: 'x', description: 'x', callback: cb }]));
      unmount();
      fireKey('x');
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('useNavigationShortcuts', () => {
    it('Alt+1 selects first tab', () => {
      const setTab = vi.fn();
      renderHook(() => useNavigationShortcuts(['tab1', 'tab2', 'tab3'], 'tab1', setTab));
      fireKey('1', { altKey: true });
      expect(setTab).toHaveBeenCalledWith('tab1');
    });

    it('Alt+2 selects second tab', () => {
      const setTab = vi.fn();
      renderHook(() => useNavigationShortcuts(['tab1', 'tab2', 'tab3'], 'tab1', setTab));
      fireKey('2', { altKey: true });
      expect(setTab).toHaveBeenCalledWith('tab2');
    });

    it('ignores Alt+number beyond tab count', () => {
      const setTab = vi.fn();
      renderHook(() => useNavigationShortcuts(['tab1', 'tab2'], 'tab1', setTab));
      fireKey('5', { altKey: true });
      expect(setTab).not.toHaveBeenCalled();
    });

    it('Ctrl+Tab goes to next tab', () => {
      const setTab = vi.fn();
      renderHook(() => useNavigationShortcuts(['a', 'b', 'c'], 'a', setTab));
      fireKey('Tab', { ctrlKey: true });
      expect(setTab).toHaveBeenCalledWith('b');
    });

    it('Ctrl+Shift+Tab goes to previous tab', () => {
      const setTab = vi.fn();
      renderHook(() => useNavigationShortcuts(['a', 'b', 'c'], 'b', setTab));
      fireKey('Tab', { ctrlKey: true, shiftKey: true });
      expect(setTab).toHaveBeenCalledWith('a');
    });

    it('wraps around forward', () => {
      const setTab = vi.fn();
      renderHook(() => useNavigationShortcuts(['a', 'b', 'c'], 'c', setTab));
      fireKey('Tab', { ctrlKey: true });
      expect(setTab).toHaveBeenCalledWith('a');
    });

    it('wraps around backward', () => {
      const setTab = vi.fn();
      renderHook(() => useNavigationShortcuts(['a', 'b', 'c'], 'a', setTab));
      fireKey('Tab', { ctrlKey: true, shiftKey: true });
      expect(setTab).toHaveBeenCalledWith('c');
    });
  });
});
