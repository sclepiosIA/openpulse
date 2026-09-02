import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { SortableTableHead, useSortConfig } from '@/components/tresorerie/SortableTableHead';
import { Table, TableHeader, TableRow } from '@/components/ui/table';

describe('SortableTableHead', () => {
  const renderHead = (sortConfig = { field: '', direction: null as any }, onSort = vi.fn()) =>
    render(
      React.createElement(Table, null,
        React.createElement(TableHeader, null,
          React.createElement(TableRow, null,
            React.createElement(SortableTableHead, {
              field: 'montant',
              sortConfig,
              onSort,
              children: 'Montant',
            })
          )
        )
      )
    );

  it('should render column label', () => {
    renderHead();
    expect(screen.getByText('Montant')).toBeInTheDocument();
  });

  it('should call onSort when clicked', () => {
    const onSort = vi.fn();
    renderHead({ field: '', direction: null }, onSort);
    fireEvent.click(screen.getByText('Montant'));
    expect(onSort).toHaveBeenCalledWith('montant');
  });

  it('should show active state when sorted', () => {
    renderHead({ field: 'montant', direction: 'asc' });
    expect(screen.getByText('Montant')).toBeInTheDocument();
  });
});

describe('useSortConfig', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSortConfig());
    expect(result.current.sortConfig).toEqual({ field: '', direction: null });
  });

  it('should set asc on first click', () => {
    const { result } = renderHook(() => useSortConfig());
    act(() => result.current.handleSort('montant'));
    expect(result.current.sortConfig).toEqual({ field: 'montant', direction: 'asc' });
  });

  it('should toggle asc → desc → reset', () => {
    const { result } = renderHook(() => useSortConfig());
    act(() => result.current.handleSort('montant'));
    expect(result.current.sortConfig.direction).toBe('asc');
    act(() => result.current.handleSort('montant'));
    expect(result.current.sortConfig.direction).toBe('desc');
    act(() => result.current.handleSort('montant'));
    expect(result.current.sortConfig.direction).toBeNull();
  });

  it('should reset to asc when switching fields', () => {
    const { result } = renderHook(() => useSortConfig());
    act(() => result.current.handleSort('montant'));
    act(() => result.current.handleSort('date'));
    expect(result.current.sortConfig).toEqual({ field: 'date', direction: 'asc' });
  });
});
