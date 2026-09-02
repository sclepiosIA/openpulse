import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CategorySelect, CategoryItem } from '@/components/tresorerie/CategorySelect';

describe('CategorySelect', () => {
  const categories: CategoryItem[] = [
    { id: 'p1', code: 'SALAIRES', nom: 'Salaires', couleur: '#3b82f6', niveau: 1 },
    { id: 'p2', code: 'CHARGES', nom: 'Charges', couleur: '#ef4444', niveau: 1 },
    { id: 'c1', code: 'SAL_NET', nom: 'Salaires nets', parent_id: 'p1', niveau: 2 },
    { id: 'c2', code: 'SAL_BRUT', nom: 'Salaires bruts', parent_id: 'p1', niveau: 2 },
  ];

  it('should render placeholder when no value', () => {
    render(React.createElement(CategorySelect, {
      value: null,
      onSelect: vi.fn(),
      categories,
    }));
    expect(screen.getByText('Non catégorisé')).toBeInTheDocument();
  });

  it('should render selected category label', () => {
    render(React.createElement(CategorySelect, {
      value: 'SAL_NET',
      onSelect: vi.fn(),
      categories,
    }));
    expect(screen.getByText('Salaires > Salaires nets')).toBeInTheDocument();
  });

  it('should render parent category without children', () => {
    render(React.createElement(CategorySelect, {
      value: 'CHARGES',
      onSelect: vi.fn(),
      categories,
    }));
    expect(screen.getByText('Charges')).toBeInTheDocument();
  });

  it('should render disabled state', () => {
    render(React.createElement(CategorySelect, {
      value: 'SAL_NET',
      onSelect: vi.fn(),
      categories,
      disabled: true,
    }));
    expect(screen.getByText('Salaires > Salaires nets')).toBeInTheDocument();
    // No button rendered in disabled state
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('should show "Non catégorisé" when disabled without value', () => {
    render(React.createElement(CategorySelect, {
      value: null,
      onSelect: vi.fn(),
      categories,
      disabled: true,
    }));
    expect(screen.getByText('Non catégorisé')).toBeInTheDocument();
  });
});
