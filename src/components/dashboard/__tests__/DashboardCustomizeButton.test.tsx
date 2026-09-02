import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DashboardCustomizeButton } from '@/components/dashboard/DashboardCustomizeButton';

describe('DashboardCustomizeButton', () => {
  const actions = {
    startEdit: vi.fn(),
    cancelEdit: vi.fn(),
    saveLayout: vi.fn(),
    resetToDefault: vi.fn(),
    openWidgetSelector: vi.fn(),
    applyTemplate: vi.fn(),
  };

  it('should render customize button in normal mode', () => {
    render(React.createElement(DashboardCustomizeButton, { isEditMode: false, isSaving: false, actions }));
    expect(screen.getByText('Personnaliser')).toBeInTheDocument();
  });

  it('should show save/cancel in edit mode', () => {
    render(React.createElement(DashboardCustomizeButton, { isEditMode: true, isSaving: false, actions }));
    expect(screen.getByText('Enregistrer')).toBeInTheDocument();
    expect(screen.getByText('Annuler')).toBeInTheDocument();
  });

  it('should call saveLayout when save clicked', () => {
    render(React.createElement(DashboardCustomizeButton, { isEditMode: true, isSaving: false, actions }));
    fireEvent.click(screen.getByText('Enregistrer'));
    expect(actions.saveLayout).toHaveBeenCalled();
  });

  it('should call cancelEdit when cancel clicked', () => {
    render(React.createElement(DashboardCustomizeButton, { isEditMode: true, isSaving: false, actions }));
    fireEvent.click(screen.getByText('Annuler'));
    expect(actions.cancelEdit).toHaveBeenCalled();
  });
});
