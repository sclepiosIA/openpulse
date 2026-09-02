import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

const mockActions = {
  selectThread: vi.fn(),
  startComposing: vi.fn(),
  editDraft: vi.fn(),
  goBack: vi.fn(),
};

const mockState = {
  selectedThread: null as string | null,
  composing: false,
  draftToEdit: null,
  threads: [
    { id: 't1', subject: 'Thread 1' },
    { id: 't2', subject: 'Thread 2' },
    { id: 't3', subject: 'Thread 3' },
  ],
};

vi.mock('@/contexts/EmailContext', () => ({
  useEmailContext: () => ({
    state: mockState,
    actions: mockActions,
  }),
}));

import { useEmailNavigation } from '../email/useEmailNavigation';

describe('useEmailNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.selectedThread = null;
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useEmailNavigation());
    expect(result.current.selectedThread).toBeNull();
    expect(result.current.composing).toBe(false);
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrevious).toBe(false);
  });

  it('selects thread', () => {
    const { result } = renderHook(() => useEmailNavigation());
    act(() => result.current.selectThread('t1', 'Thread 1'));
    expect(mockActions.selectThread).toHaveBeenCalledWith('t1', 'Thread 1');
  });

  it('closes thread', () => {
    const { result } = renderHook(() => useEmailNavigation());
    act(() => result.current.closeThread());
    expect(mockActions.selectThread).toHaveBeenCalledWith(null);
  });

  it('starts composing', () => {
    const { result } = renderHook(() => useEmailNavigation());
    act(() => result.current.startComposing());
    expect(mockActions.startComposing).toHaveBeenCalled();
  });

  it('goes back', () => {
    const { result } = renderHook(() => useEmailNavigation());
    act(() => result.current.goBack());
    expect(mockActions.goBack).toHaveBeenCalled();
  });

  it('navigates to next thread', () => {
    mockState.selectedThread = 't1';
    const { result } = renderHook(() => useEmailNavigation());
    expect(result.current.canGoNext).toBe(true);
    act(() => result.current.selectNextThread());
    expect(mockActions.selectThread).toHaveBeenCalledWith('t2', 'Thread 2');
  });

  it('navigates to previous thread', () => {
    mockState.selectedThread = 't2';
    const { result } = renderHook(() => useEmailNavigation());
    expect(result.current.canGoPrevious).toBe(true);
    act(() => result.current.selectPreviousThread());
    expect(mockActions.selectThread).toHaveBeenCalledWith('t1', 'Thread 1');
  });

  it('cannot go next from last thread', () => {
    mockState.selectedThread = 't3';
    const { result } = renderHook(() => useEmailNavigation());
    expect(result.current.canGoNext).toBe(false);
  });

  it('cannot go previous from first thread', () => {
    mockState.selectedThread = 't1';
    const { result } = renderHook(() => useEmailNavigation());
    expect(result.current.canGoPrevious).toBe(false);
  });
});
