import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardCustomizeButton } from '../DashboardCustomizeButton';

const actions = {
  startEdit: vi.fn(),
  cancelEdit: vi.fn(),
  saveLayout: vi.fn(),
  resetToDefault: vi.fn(),
  openWidgetSelector: vi.fn(),
  applyTemplate: vi.fn(),
};

describe('DashboardCustomizeButton', () => {
  it('renders button in non-edit mode', () => {
    const { container } = render(
      <DashboardCustomizeButton isEditMode={false} isSaving={false} actions={actions} />
    );
    expect(container.querySelector('button')).toBeInTheDocument();
  });

  it('renders save/cancel in edit mode', () => {
    render(
      <DashboardCustomizeButton isEditMode={true} isSaving={false} actions={actions} />
    );
    expect(screen.getByText('Enregistrer')).toBeInTheDocument();
  });
});
