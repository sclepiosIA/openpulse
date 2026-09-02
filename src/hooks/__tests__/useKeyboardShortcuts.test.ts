import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, useNavigationShortcuts } from '../ui/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  it('fires callback on matching key combo', () => {
    const cb = vi.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'k', ctrl: true, description: 'search', callback: cb },
    ]));

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not fire on non-matching key', () => {
    const cb = vi.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'k', ctrl: true, description: 'search', callback: cb },
    ]));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true }));
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not fire without required modifier', () => {
    const cb = vi.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'k', ctrl: true, description: 'search', callback: cb },
    ]));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('useNavigationShortcuts', () => {
  it('navigates to tab via Alt+number', () => {
    const setActiveTab = vi.fn();
    const tabs = ['tab1', 'tab2', 'tab3'];
    renderHook(() => useNavigationShortcuts(tabs, 'tab1', setActiveTab));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true, bubbles: true }));
    expect(setActiveTab).toHaveBeenCalledWith('tab2');
  });

  it('ignores Alt+number beyond tabs length', () => {
    const setActiveTab = vi.fn();
    renderHook(() => useNavigationShortcuts(['a', 'b'], 'a', setActiveTab));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '5', altKey: true, bubbles: true }));
    expect(setActiveTab).not.toHaveBeenCalled();
  });
});
