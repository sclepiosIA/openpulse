import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PDFToolbar } from '../PDFToolbar';

const baseProps = {
  filename: 'document.pdf',
  currentPage: 3,
  numPages: 10,
  scale: 1.0,
  viewMode: 'single' as const,
  fitMode: 'width' as const,
  showThumbnails: false,
  isFullscreen: false,
  onPageChange: vi.fn(),
  onPrevPage: vi.fn(),
  onNextPage: vi.fn(),
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onFitToWidth: vi.fn(),
  onFitToPage: vi.fn(),
  onToggleViewMode: vi.fn(),
  onToggleThumbnails: vi.fn(),
  onToggleFullscreen: vi.fn(),
  onDownload: vi.fn(),
  onClose: vi.fn(),
};

describe('PDFToolbar', () => {
  it('renders filename', () => {
    render(<TooltipProvider><PDFToolbar {...baseProps} /></TooltipProvider>);
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
  });

  it('renders page count', () => {
    render(<TooltipProvider><PDFToolbar {...baseProps} /></TooltipProvider>);
    const spans = screen.getAllByText(/10/);
    expect(spans.length).toBeGreaterThanOrEqual(1);
  });

  it('renders zoom percentage', () => {
    render(<TooltipProvider><PDFToolbar {...baseProps} /></TooltipProvider>);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
