import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalendarKeyboard, CALENDAR_SHORTCUTS } from '../calendar/useCalendarKeyboard';

describe('useCalendarKeyboard extended', () => {
  const createHandlers = () => ({
    onNewEvent: vi.fn(),
    onNewTask: vi.fn(),
    onToggleFilters: vi.fn(),
    onPreviousPeriod: vi.fn(),
    onNextPeriod: vi.fn(),
    onToday: vi.fn(),
  });

  const fireKey = (key: string, opts: Partial<KeyboardEventInit> = {}) => {
    act(() => {
      // Dispatch from a real DOM element so target.closest works
      const div = document.createElement('div');
      document.body.appendChild(div);
      div.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
      document.body.removeChild(div);
    });
  };

  describe('CALENDAR_SHORTCUTS', () => {
    it('has 6 shortcuts', () => expect(CALENDAR_SHORTCUTS).toHaveLength(6));
    it('includes N for event', () => expect(CALENDAR_SHORTCUTS.find(s => s.key === 'N')).toBeDefined());
    it('includes T for task', () => expect(CALENDAR_SHORTCUTS.find(s => s.key === 'T')).toBeDefined());
    it('includes F for filters', () => expect(CALENDAR_SHORTCUTS.find(s => s.key === 'F')).toBeDefined());
    it('includes H for today', () => expect(CALENDAR_SHORTCUTS.find(s => s.key === 'H')).toBeDefined());
  });

  describe('keyboard handlers', () => {
    it('N → onNewEvent', () => {
      const h = createHandlers();
      renderHook(() => useCalendarKeyboard(h));
      fireKey('n');
      expect(h.onNewEvent).toHaveBeenCalledTimes(1);
    });

    it('T → onNewTask', () => {
      const h = createHandlers();
      renderHook(() => useCalendarKeyboard(h));
      fireKey('t');
      expect(h.onNewTask).toHaveBeenCalledTimes(1);
    });

    it('F → onToggleFilters', () => {
      const h = createHandlers();
      renderHook(() => useCalendarKeyboard(h));
      fireKey('f');
      expect(h.onToggleFilters).toHaveBeenCalledTimes(1);
    });

    it('ArrowLeft → onPreviousPeriod', () => {
      const h = createHandlers();
      renderHook(() => useCalendarKeyboard(h));
      fireKey('ArrowLeft');
      expect(h.onPreviousPeriod).toHaveBeenCalledTimes(1);
    });

    it('ArrowRight → onNextPeriod', () => {
      const h = createHandlers();
      renderHook(() => useCalendarKeyboard(h));
      fireKey('ArrowRight');
      expect(h.onNextPeriod).toHaveBeenCalledTimes(1);
    });

    it('H → onToday', () => {
      const h = createHandlers();
      renderHook(() => useCalendarKeyboard(h));
      fireKey('h');
      expect(h.onToday).toHaveBeenCalledTimes(1);
    });

    it('ignores with Ctrl modifier', () => {
      const h = createHandlers();
      renderHook(() => useCalendarKeyboard(h));
      fireKey('n', { ctrlKey: true });
      expect(h.onNewEvent).not.toHaveBeenCalled();
    });

    it('does nothing when disabled', () => {
      const h = createHandlers();
      renderHook(() => useCalendarKeyboard({ ...h, enabled: false }));
      fireKey('n');
      expect(h.onNewEvent).not.toHaveBeenCalled();
    });

    it('cleans up on unmount', () => {
      const h = createHandlers();
      const { unmount } = renderHook(() => useCalendarKeyboard(h));
      unmount();
      fireKey('n');
      expect(h.onNewEvent).not.toHaveBeenCalled();
    });
  });
});
