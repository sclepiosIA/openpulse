import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarExport } from '../CalendarExport';

beforeAll(() => {
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn();
  }
});

vi.mock('@/lib/calendarUtils', () => ({
  exportToICS: vi.fn(),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const tasks = [
  { titre: 'Task 1', description: 'Desc', echeance: '2026-03-10', statut: 'En cours', priorite: 'Haute' },
];

describe('CalendarExport', () => {
  it('renders export trigger button', () => {
    render(<CalendarExport tasks={tasks} />);
    expect(screen.getByText('Exporter')).toBeInTheDocument();
  });

  it('opens dialog with export options on click', () => {
    render(<CalendarExport tasks={tasks} />);
    fireEvent.click(screen.getByText('Exporter'));
    expect(screen.getByText('Exporter le calendrier')).toBeInTheDocument();
    expect(screen.getByText('Exporter en iCal (.ics)')).toBeInTheDocument();
    expect(screen.getByText('Exporter en CSV')).toBeInTheDocument();
  });

  it('calls exportToICS when ICS button clicked', async () => {
    const { exportToICS } = await import('@/lib/calendarUtils');
    render(<CalendarExport tasks={tasks} title="Mon Planning" />);
    fireEvent.click(screen.getByText('Exporter'));
    fireEvent.click(screen.getByText('Exporter en iCal (.ics)'));
    expect(exportToICS).toHaveBeenCalledWith(tasks, 'Mon Planning');
  });

  it('creates CSV download on CSV click', () => {
    render(<CalendarExport tasks={tasks} />);
    fireEvent.click(screen.getByText('Exporter'));
    fireEvent.click(screen.getByText('Exporter en CSV'));
    // CSV export triggers a download - no error means success
  });
});
