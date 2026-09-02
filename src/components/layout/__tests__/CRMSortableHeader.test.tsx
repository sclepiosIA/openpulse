import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CRMSortableHeader } from '../CRMSortableHeader';

describe('CRMSortableHeader', () => {
  it('renders children', () => {
    render(
      <table><thead><tr>
        <CRMSortableHeader field="nom" currentSortField="nom" currentSortDirection="asc" onSort={vi.fn()}>
          Nom
        </CRMSortableHeader>
      </tr></thead></table>
    );
    expect(screen.getByText('Nom')).toBeInTheDocument();
  });

  it('calls onSort when clicked', () => {
    const onSort = vi.fn();
    render(
      <table><thead><tr>
        <CRMSortableHeader field="nom" currentSortField="ville" currentSortDirection="asc" onSort={onSort}>
          Nom
        </CRMSortableHeader>
      </tr></thead></table>
    );
    fireEvent.click(screen.getByText('Nom'));
    expect(onSort).toHaveBeenCalledWith('nom');
  });
});
