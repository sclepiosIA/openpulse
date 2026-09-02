import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FinderActionBar } from '../FinderActionBar';

const wrap = (ui: React.ReactElement) => <TooltipProvider>{ui}</TooltipProvider>;

describe('FinderActionBar', () => {
  it('renders action buttons', () => {
    render(wrap(<FinderActionBar onPreview={vi.fn()} onDownload={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByText('Aperçu')).toBeInTheDocument();
    expect(screen.getByText('Télécharger')).toBeInTheDocument();
    expect(screen.getByText('Supprimer')).toBeInTheDocument();
  });

  it('calls onPreview on click', () => {
    const onPreview = vi.fn();
    render(wrap(<FinderActionBar onPreview={onPreview} />));
    fireEvent.click(screen.getByText('Aperçu').closest('button')!);
    expect(onPreview).toHaveBeenCalled();
  });

  it('hides actions when hide props set', () => {
    render(wrap(<FinderActionBar onPreview={vi.fn()} hidePreview onDownload={vi.fn()} />));
    expect(screen.queryByText('Aperçu')).not.toBeInTheDocument();
    expect(screen.getByText('Télécharger')).toBeInTheDocument();
  });

  it('renders nothing when no actions provided', () => {
    const { container } = render(wrap(<FinderActionBar />));
    expect(container.querySelectorAll('button').length).toBe(0);
  });
});
