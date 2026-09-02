import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RHQuickActions } from '@/components/rh/RHQuickActions';

describe('RHQuickActions', () => {
  it('should render upload bulletin button', () => {
    render(<RHQuickActions onUploadBulletin={vi.fn()} />);
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('should call onUploadBulletin when clicked', () => {
    const handler = vi.fn();
    render(<RHQuickActions onUploadBulletin={handler} />);
    fireEvent.click(screen.getByText('Upload'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should render add salaire button', () => {
    render(<RHQuickActions onAddSalaire={vi.fn()} />);
    expect(screen.getByText('Manuel')).toBeInTheDocument();
  });

  it('should render export button', () => {
    render(<RHQuickActions onExport={vi.fn()} />);
    expect(screen.getByText('Exporter')).toBeInTheDocument();
  });

  it('should render reanalyze button', () => {
    render(<RHQuickActions onReanalyze={vi.fn()} />);
    expect(screen.getByText('Réanalyser')).toBeInTheDocument();
  });

  it('should show reanalyzing state', () => {
    render(<RHQuickActions onReanalyze={vi.fn()} isReanalyzing={true} />);
    expect(screen.getByText('En cours...')).toBeInTheDocument();
  });

  it('should render view all button', () => {
    render(<RHQuickActions onViewAll={vi.fn()} />);
    expect(screen.getByText('Tout voir')).toBeInTheDocument();
  });

  it('should render upload multiple button', () => {
    render(<RHQuickActions onUploadMultiple={vi.fn()} />);
    expect(screen.getByText('📥 Multi')).toBeInTheDocument();
  });

  it('should not render buttons without handlers', () => {
    const { container } = render(<RHQuickActions />);
    expect(container.querySelectorAll('button').length).toBe(0);
  });
});
