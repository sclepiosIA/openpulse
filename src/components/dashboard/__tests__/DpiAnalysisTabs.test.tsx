import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DpiAnalysisTabs } from '../DpiAnalysisTabs';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive">{children}</div>,
    PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
    Pie: ({ children }: any) => <div>{children}</div>,
    Cell: () => null,
  };
});

describe('DpiAnalysisTabs', () => {
  const props = {
    byDPI: {
      'DPI Lourd': { count: 10, percentage: 60, totalPassages: 5000, totalValue: 100000 },
      'DPI Web': { count: 7, percentage: 40, totalPassages: 3000, totalValue: 50000 },
    },
    bySpecificDPI: {
      'Orbis': { count: 5, percentage: 30, totalPassages: 2000, totalValue: 40000 },
      'Easily': { count: 3, percentage: 20, totalPassages: 1500, totalValue: 25000 },
    },
    onDpiTypeClick: vi.fn(),
    onSpecificDpiClick: vi.fn(),
    chartConfig: {
      'DPI Lourd': { label: 'DPI Lourd', color: '#3b82f6' },
      'DPI Web': { label: 'DPI Web', color: '#10b981' },
    },
    getSpecificDpiColor: (_dpi: string, i: number) => ['#f00', '#0f0'][i] || '#999',
  };

  it('renders two tab triggers', () => {
    render(<DpiAnalysisTabs {...props} />);
    expect(screen.getByText('Par Type (Lourd/Web)')).toBeInTheDocument();
    expect(screen.getByText('Par DPI Spécifique')).toBeInTheDocument();
  });

  it('renders DPI type legend items', () => {
    render(<DpiAnalysisTabs {...props} />);
    expect(screen.getByText('DPI Lourd')).toBeInTheDocument();
    expect(screen.getByText('DPI Web')).toBeInTheDocument();
  });

  it('shows passages count', () => {
    render(<DpiAnalysisTabs {...props} />);
    expect(screen.getByText(/5[\s\u202f]?000 passages/)).toBeInTheDocument();
  });

  it('calls onDpiTypeClick when legend clicked', () => {
    render(<DpiAnalysisTabs {...props} />);
    fireEvent.click(screen.getByText('DPI Lourd').closest('[role="button"]')!);
    expect(props.onDpiTypeClick).toHaveBeenCalledWith('DPI Lourd');
  });
});
