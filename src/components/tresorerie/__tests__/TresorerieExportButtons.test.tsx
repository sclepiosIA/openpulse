import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TresorerieExportButtons } from '../TresorerieExportButtons';

vi.mock('@/lib/export/dynamicPdfImport', () => ({
  loadPdfLibs: vi.fn(),
  loadExcelLibs: vi.fn(),
  preloadExportLibs: vi.fn(),
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

const defaultProps = {
  revenus: [],
  depenses: [],
  qontoBalance: 50000,
  moisCourant: '2026-03',
};

describe('TresorerieExportButtons', () => {
  it('renders export button', () => {
    render(<TresorerieExportButtons {...defaultProps} />);
    expect(screen.getByText('Exporter')).toBeInTheDocument();
  });

  it('renders compact variant without text', () => {
    render(<TresorerieExportButtons {...defaultProps} compact />);
    expect(screen.queryByText('Exporter')).not.toBeInTheDocument();
  });

  it('renders download icon button', () => {
    const { container } = render(<TresorerieExportButtons {...defaultProps} />);
    expect(container.querySelector('button')).toBeInTheDocument();
  });
});
