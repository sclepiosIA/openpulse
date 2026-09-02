import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEmailFilters } from '../email/useEmailFilters';

describe('useEmailFilters', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useEmailFilters(false));
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.category).toBeNull();
    expect(result.current.filters.priority).toBeNull();
    expect(result.current.filters.unreadOnly).toBe(false);
    expect(result.current.filters.unprocessedOnly).toBe(false);
    expect(result.current.filters.dateFrom).toBeNull();
    expect(result.current.filters.dateTo).toBeNull();
    expect(result.current.filters.mailbox).toBe('inbox');
  });

  it('updateFilter updates search', () => {
    const { result } = renderHook(() => useEmailFilters(false));
    act(() => result.current.updateFilter('search', 'test query'));
    expect(result.current.filters.search).toBe('test query');
  });

  it('updateFilter updates category', () => {
    const { result } = renderHook(() => useEmailFilters(false));
    act(() => result.current.updateFilter('category', 'Commercial'));
    expect(result.current.filters.category).toBe('Commercial');
  });

  it('updateFilter updates unreadOnly', () => {
    const { result } = renderHook(() => useEmailFilters(false));
    act(() => result.current.updateFilter('unreadOnly', true));
    expect(result.current.filters.unreadOnly).toBe(true);
  });

  it('updateFilter updates mailbox', () => {
    const { result } = renderHook(() => useEmailFilters(false));
    act(() => result.current.updateFilter('mailbox', 'sent'));
    expect(result.current.filters.mailbox).toBe('sent');
  });

  it('updateFilter updates etablissementId', () => {
    const { result } = renderHook(() => useEmailFilters(false));
    act(() => result.current.updateFilter('etablissementId', 'etab-1'));
    expect(result.current.filters.etablissementId).toBe('etab-1');
  });

  it('resetFilters restores defaults', () => {
    const { result } = renderHook(() => useEmailFilters(false));
    act(() => result.current.updateFilter('search', 'test'));
    act(() => result.current.updateFilter('unreadOnly', true));
    act(() => result.current.updateFilter('mailbox', 'sent'));
    act(() => result.current.resetFilters());
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.unreadOnly).toBe(false);
    expect(result.current.filters.mailbox).toBe('inbox');
  });

  it('updateFilter updates dateFrom', () => {
    const { result } = renderHook(() => useEmailFilters(false));
    const date = new Date(2026, 0, 1);
    act(() => result.current.updateFilter('dateFrom', date));
    expect(result.current.filters.dateFrom).toEqual(date);
  });

  it('updateFilter updates priority', () => {
    const { result } = renderHook(() => useEmailFilters(false));
    act(() => result.current.updateFilter('priority', 'high'));
    expect(result.current.filters.priority).toBe('high');
  });
});
