import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgendaWidget } from '../AgendaWidget';

vi.mock('@/hooks/bookings/useUpcomingAppointments', () => ({
  useUpcomingAppointments: () => ({
    data: [
      { id: '1', title: 'Réunion client', start_time: new Date().toISOString(), end_time: new Date().toISOString(), calendar_name: 'Pro', color: '#3b82f6', hasConflict: false },
    ],
    isLoading: false,
  }),
}));

vi.mock('../AgendaWidgetItem', () => ({
  AgendaWidgetItem: ({ appointment }: any) => <div>{appointment.title}</div>,
}));

vi.mock('../AgendaWeekView', () => ({
  AgendaWeekView: () => <div>WeekView</div>,
}));

vi.mock('@/components/calendrier/EventFormDialog', () => ({
  EventFormDialog: () => null,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('AgendaWidget', () => {
  const renderWidget = () =>
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AgendaWidget />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders agenda title', () => {
    renderWidget();
    expect(screen.getByText('Agenda')).toBeInTheDocument();
  });

  it('renders appointment', () => {
    renderWidget();
    expect(screen.getByText('Réunion client')).toBeInTheDocument();
  });

  it('renders view toggle tabs', () => {
    renderWidget();
    expect(screen.getByText('Liste')).toBeInTheDocument();
    expect(screen.getByText('Semaine')).toBeInTheDocument();
  });

  it('renders today label', () => {
    renderWidget();
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
  });
});
