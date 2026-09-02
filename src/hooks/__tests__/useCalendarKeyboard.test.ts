import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarKeyboard, CALENDAR_SHORTCUTS } from '../calendar/useCalendarKeyboard';

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  // Dispatch from document.body so target is an HTMLElement with .closest()
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

describe('useCalendarKeyboard', () => {
  it('calls onNewEvent on N key', () => {
    const onNewEvent = vi.fn();
    renderHook(() => useCalendarKeyboard({
      onNewEvent, onNewTask: vi.fn(), onToggleFilters: vi.fn(),
      onPreviousPeriod: vi.fn(), onNextPeriod: vi.fn(), onToday: vi.fn(),
    }));
    fireKey('n');
    expect(onNewEvent).toHaveBeenCalledTimes(1);
  });

  it('calls onNewTask on T key', () => {
    const onNewTask = vi.fn();
    renderHook(() => useCalendarKeyboard({
      onNewEvent: vi.fn(), onNewTask, onToggleFilters: vi.fn(),
      onPreviousPeriod: vi.fn(), onNextPeriod: vi.fn(), onToday: vi.fn(),
    }));
    fireKey('t');
    expect(onNewTask).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleFilters on F key', () => {
    const fn = vi.fn();
    renderHook(() => useCalendarKeyboard({
      onNewEvent: vi.fn(), onNewTask: vi.fn(), onToggleFilters: fn,
      onPreviousPeriod: vi.fn(), onNextPeriod: vi.fn(), onToday: vi.fn(),
    }));
    fireKey('f');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onPreviousPeriod on ArrowLeft', () => {
    const fn = vi.fn();
    renderHook(() => useCalendarKeyboard({
      onNewEvent: vi.fn(), onNewTask: vi.fn(), onToggleFilters: vi.fn(),
      onPreviousPeriod: fn, onNextPeriod: vi.fn(), onToday: vi.fn(),
    }));
    fireKey('ArrowLeft');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onToday on H key', () => {
    const fn = vi.fn();
    renderHook(() => useCalendarKeyboard({
      onNewEvent: vi.fn(), onNewTask: vi.fn(), onToggleFilters: vi.fn(),
      onPreviousPeriod: vi.fn(), onNextPeriod: vi.fn(), onToday: fn,
    }));
    fireKey('h');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores keys with modifier', () => {
    const fn = vi.fn();
    renderHook(() => useCalendarKeyboard({
      onNewEvent: fn, onNewTask: vi.fn(), onToggleFilters: vi.fn(),
      onPreviousPeriod: vi.fn(), onNextPeriod: vi.fn(), onToday: vi.fn(),
    }));
    fireKey('n', { ctrlKey: true });
    expect(fn).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const fn = vi.fn();
    renderHook(() => useCalendarKeyboard({
      onNewEvent: fn, onNewTask: vi.fn(), onToggleFilters: vi.fn(),
      onPreviousPeriod: vi.fn(), onNextPeriod: vi.fn(), onToday: vi.fn(),
      enabled: false,
    }));
    fireKey('n');
    expect(fn).not.toHaveBeenCalled();
  });

  it('exports CALENDAR_SHORTCUTS with 6 entries', () => {
    expect(CALENDAR_SHORTCUTS).toHaveLength(6);
    expect(CALENDAR_SHORTCUTS[0]).toHaveProperty('key');
    expect(CALENDAR_SHORTCUTS[0]).toHaveProperty('description');
  });
});
