// @vitest-environment jsdom
import React, { type PropsWithChildren, createElement } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CALENDAR_SHORTCUTS, useCalendarKeyboard } from './useCalendarKeyboard';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createKeyboardEvent(
  key: string,
  target: EventTarget,
  options?: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: options?.ctrlKey ?? false,
    metaKey: options?.metaKey ?? false,
    altKey: options?.altKey ?? false,
  });

  Object.defineProperty(event, 'target', {
    value: target,
    configurable: true,
  });

  return event;
}

describe('useCalendarKeyboard', () => {
  it('déclenche les callbacks métier attendus pour les raccourcis supportés', () => {
    const onNewEvent = vi.fn();
    const onNewTask = vi.fn();
    const onToggleFilters = vi.fn();
    const onPreviousPeriod = vi.fn();
    const onNextPeriod = vi.fn();
    const onToday = vi.fn();

    renderHook(
      () =>
        useCalendarKeyboard({
          onNewEvent,
          onNewTask,
          onToggleFilters,
          onPreviousPeriod,
          onNextPeriod,
          onToday,
        }),
      { wrapper: createWrapper() }
    );

    const target = document.createElement('div');
    document.body.appendChild(target);

    const eventN = createKeyboardEvent('n', target);
    const eventT = createKeyboardEvent('T', target);
    const eventF = createKeyboardEvent('f', target);
    const eventLeft = createKeyboardEvent('ArrowLeft', target);
    const eventRight = createKeyboardEvent('ArrowRight', target);
    const eventH = createKeyboardEvent('h', target);

    document.dispatchEvent(eventN);
    document.dispatchEvent(eventT);
    document.dispatchEvent(eventF);
    document.dispatchEvent(eventLeft);
    document.dispatchEvent(eventRight);
    document.dispatchEvent(eventH);

    expect(onNewEvent).toHaveBeenCalledTimes(1);
    expect(onNewTask).toHaveBeenCalledTimes(1);
    expect(onToggleFilters).toHaveBeenCalledTimes(1);
    expect(onPreviousPeriod).toHaveBeenCalledTimes(1);
    expect(onNextPeriod).toHaveBeenCalledTimes(1);
    expect(onToday).toHaveBeenCalledTimes(1);

    expect(eventN.defaultPrevented).toBe(true);
    expect(eventT.defaultPrevented).toBe(true);
    expect(eventF.defaultPrevented).toBe(true);
    expect(eventLeft.defaultPrevented).toBe(true);
    expect(eventRight.defaultPrevented).toBe(true);
    expect(eventH.defaultPrevented).toBe(true);
  });

  it('ignore les raccourcis dans un input, textarea et dans une dialog', () => {
    const onNewEvent = vi.fn();
    const onNewTask = vi.fn();
    const onToggleFilters = vi.fn();
    const onPreviousPeriod = vi.fn();
    const onNextPeriod = vi.fn();
    const onToday = vi.fn();

    renderHook(
      () =>
        useCalendarKeyboard({
          onNewEvent,
          onNewTask,
          onToggleFilters,
          onPreviousPeriod,
          onNextPeriod,
          onToday,
        }),
      { wrapper: createWrapper() }
    );

    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const dialogChild = document.createElement('button');
    dialog.appendChild(dialogChild);

    document.body.appendChild(input);
    document.body.appendChild(textarea);
    document.body.appendChild(dialog);

    const eventInput = createKeyboardEvent('n', input);
    const eventTextarea = createKeyboardEvent('t', textarea);
    const eventDialog = createKeyboardEvent('ArrowLeft', dialogChild);

    document.dispatchEvent(eventInput);
    document.dispatchEvent(eventTextarea);
    document.dispatchEvent(eventDialog);

    expect(onNewEvent).not.toHaveBeenCalled();
    expect(onNewTask).not.toHaveBeenCalled();
    expect(onToggleFilters).not.toHaveBeenCalled();
    expect(onPreviousPeriod).not.toHaveBeenCalled();
    expect(onNextPeriod).not.toHaveBeenCalled();
    expect(onToday).not.toHaveBeenCalled();

    expect(eventInput.defaultPrevented).toBe(false);
    expect(eventTextarea.defaultPrevented).toBe(false);
    expect(eventDialog.defaultPrevented).toBe(false);
  });

  it('ignore les raccourcis avec modificateurs et quand enabled=false, puis détache le listener au unmount', () => {
    const onNewEvent = vi.fn();
    const onNewTask = vi.fn();
    const onToggleFilters = vi.fn();
    const onPreviousPeriod = vi.fn();
    const onNextPeriod = vi.fn();
    const onToday = vi.fn();

    const target = document.createElement('div');
    document.body.appendChild(target);

    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const disabledHook = renderHook(
      () =>
        useCalendarKeyboard({
          onNewEvent,
          onNewTask,
          onToggleFilters,
          onPreviousPeriod,
          onNextPeriod,
          onToday,
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );

    const disabledEvent = createKeyboardEvent('n', target);
    document.dispatchEvent(disabledEvent);

    expect(addSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(onNewEvent).not.toHaveBeenCalled();

    disabledHook.unmount();

    const enabledHook = renderHook(
      () =>
        useCalendarKeyboard({
          onNewEvent,
          onNewTask,
          onToggleFilters,
          onPreviousPeriod,
          onNextPeriod,
          onToday,
          enabled: true,
        }),
      { wrapper: createWrapper() }
    );

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    const ctrlEvent = createKeyboardEvent('n', target, { ctrlKey: true });
    const metaEvent = createKeyboardEvent('t', target, { metaKey: true });
    const altEvent = createKeyboardEvent('ArrowRight', target, { altKey: true });

    document.dispatchEvent(ctrlEvent);
    document.dispatchEvent(metaEvent);
    document.dispatchEvent(altEvent);

    expect(onNewEvent).not.toHaveBeenCalled();
    expect(onNewTask).not.toHaveBeenCalled();
    expect(onNextPeriod).not.toHaveBeenCalled();
    expect(ctrlEvent.defaultPrevented).toBe(false);
    expect(metaEvent.defaultPrevented).toBe(false);
    expect(altEvent.defaultPrevented).toBe(false);

    enabledHook.unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    const postUnmountEvent = createKeyboardEvent('h', target);
    document.dispatchEvent(postUnmountEvent);

    expect(onToday).not.toHaveBeenCalled();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('ignore les événements dont la target n’est pas un HTMLElement', () => {
    const onNewEvent = vi.fn();
    const onNewTask = vi.fn();
    const onToggleFilters = vi.fn();
    const onPreviousPeriod = vi.fn();
    const onNextPeriod = vi.fn();
    const onToday = vi.fn();

    renderHook(
      () =>
        useCalendarKeyboard({
          onNewEvent,
          onNewTask,
          onToggleFilters,
          onPreviousPeriod,
          onNextPeriod,
          onToday,
        }),
      { wrapper: createWrapper() }
    );

    const eventFromDocument = createKeyboardEvent('n', document);
    document.dispatchEvent(eventFromDocument);

    expect(onNewEvent).not.toHaveBeenCalled();
    expect(onNewTask).not.toHaveBeenCalled();
    expect(onToggleFilters).not.toHaveBeenCalled();
    expect(onPreviousPeriod).not.toHaveBeenCalled();
    expect(onNextPeriod).not.toHaveBeenCalled();
    expect(onToday).not.toHaveBeenCalled();
    expect(eventFromDocument.defaultPrevented).toBe(false);
  });
});

describe('CALENDAR_SHORTCUTS', () => {
  it('expose la liste exacte des raccourcis d’aide attendus', () => {
    expect(CALENDAR_SHORTCUTS).toHaveLength(6);
    expect(CALENDAR_SHORTCUTS).toEqual([
      { key: 'N', description: 'Nouvel événement' },
      { key: 'T', description: 'Nouvelle tâche' },
      { key: 'F', description: 'Ouvrir/fermer filtres' },
      { key: '←', description: 'Période précédente' },
      { key: '→', description: 'Période suivante' },
      { key: 'H', description: "Aujourd'hui" },
    ]);
  });

  it('contient des touches uniques et des descriptions non vides', () => {
    const keys = CALENDAR_SHORTCUTS.map((shortcut) => shortcut.key);
    const uniqueKeys = new Set(keys);

    expect(uniqueKeys.size).toBe(6);
    expect(CALENDAR_SHORTCUTS.every((shortcut) => shortcut.description.length > 0)).toBe(true);
    expect(CALENDAR_SHORTCUTS[0]).toEqual({ key: 'N', description: 'Nouvel événement' });
    expect(CALENDAR_SHORTCUTS[5]).toEqual({ key: 'H', description: "Aujourd'hui" });
  });
});