/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { GlobalFiltersBar } from './GlobalFiltersBar';

const {
  buttonPropsCalls,
  popoverContentPropsCalls,
  calendarPropsCalls,
} = vi.hoisted(() => ({
  buttonPropsCalls: [] as Array<Record<string, unknown>>,
  popoverContentPropsCalls: [] as Array<Record<string, unknown>>,
  calendarPropsCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock('lucide-react', () => ({
  Calendar: () => <svg data-testid="calendar-icon" />,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  PopoverContent: ({ children, ...props }: { children: React.ReactNode }) => {
    popoverContentPropsCalls.push(props as Record<string, unknown>);
    return <div data-testid="popover-content">{children}</div>;
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => {
    buttonPropsCalls.push(props as Record<string, unknown>);
    return (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: (props: {
    selected?: Date;
    onSelect?: (d?: Date) => void;
    mode?: string;
    initialFocus?: boolean;
  }) => {
    calendarPropsCalls.push(props as unknown as Record<string, unknown>);
    return (
      <div data-testid="calendar-comp">
        <button type="button" onClick={() => props.onSelect?.(new Date('2024-06-15T00:00:00.000Z'))}>
          select-date
        </button>
        <button type="button" onClick={() => props.onSelect?.(undefined)}>
          clear-date
        </button>
      </div>
    );
  },
}));

describe('GlobalFiltersBar', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    return function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  };

  beforeEach(() => {
    buttonPropsCalls.length = 0;
    popoverContentPropsCalls.length = 0;
    calendarPropsCalls.length = 0;
    vi.useRealTimers();
  });

  it('affiche les libellés par défaut et les contrôles de période', () => {
    const onChange = vi.fn();

    render(<GlobalFiltersBar filters={{}} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Début')).toBeInTheDocument();
    expect(screen.getByText('Fin')).toBeInTheDocument();
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7j' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30j' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90j' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1an' })).toBeInTheDocument();

    expect(popoverContentPropsCalls).toHaveLength(2);
    expect(popoverContentPropsCalls[0]).toMatchObject({ align: 'start', className: 'w-auto p-0 z-50 bg-popover' });
    expect(popoverContentPropsCalls[1]).toMatchObject({ align: 'start', className: 'w-auto p-0 z-50 bg-popover' });

    expect(calendarPropsCalls).toHaveLength(2);
    expect(calendarPropsCalls[0]).toMatchObject({ mode: 'single', selected: undefined, initialFocus: true });
    expect(calendarPropsCalls[1]).toMatchObject({ mode: 'single', selected: undefined, initialFocus: true });
  });

  it('affiche les dates formatées en français quand les filtres sont renseignés', () => {
    const onChange = vi.fn();

    render(
      <GlobalFiltersBar
        filters={{
          date_start: '2024-01-05',
          date_end: '2024-02-10',
        }}
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('05 janv. 2024')).toBeInTheDocument();
    expect(screen.getByText('10 févr. 2024')).toBeInTheDocument();

    expect(calendarPropsCalls[0].selected).toEqual(new Date('2024-01-05'));
    expect(calendarPropsCalls[1].selected).toEqual(new Date('2024-02-10'));
  });

  it('appelle onChange avec date_start ISO lors de la sélection du calendrier de début', () => {
    const onChange = vi.fn();
    render(
      <GlobalFiltersBar
        filters={{
          date_start: '2024-01-01',
          date_end: '2024-01-31',
        }}
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );

    const selectButtons = screen.getAllByRole('button', { name: 'select-date' });
    fireEvent.click(selectButtons[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      date_start: '2024-06-15',
      date_end: '2024-01-31',
    });
  });

  it('appelle onChange avec date_end ISO lors de la sélection du calendrier de fin', () => {
    const onChange = vi.fn();
    render(
      <GlobalFiltersBar
        filters={{
          date_start: '2024-01-01',
          date_end: '2024-01-31',
        }}
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );

    const selectButtons = screen.getAllByRole('button', { name: 'select-date' });
    fireEvent.click(selectButtons[1]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      date_start: '2024-01-01',
      date_end: '2024-06-15',
    });
  });

  it('permet d’effacer la date de début et de fin', () => {
    const onChange = vi.fn();
    render(
      <GlobalFiltersBar
        filters={{
          date_start: '2024-01-01',
          date_end: '2024-01-31',
        }}
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );

    const clearButtons = screen.getAllByRole('button', { name: 'clear-date' });

    fireEvent.click(clearButtons[0]);
    expect(onChange).toHaveBeenNthCalledWith(1, {
      date_start: undefined,
      date_end: '2024-01-31',
    });

    fireEvent.click(clearButtons[1]);
    expect(onChange).toHaveBeenNthCalledWith(2, {
      date_start: '2024-01-01',
      date_end: undefined,
    });
  });

  it('applique le raccourci 7j avec des dates calculées depuis aujourd’hui', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-07-20T12:00:00.000Z'));

    const onChange = vi.fn();
    render(<GlobalFiltersBar filters={{}} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: '7j' }));

    expect(onChange).toHaveBeenCalledWith({
      date_start: '2024-07-13',
      date_end: '2024-07-20',
    });
  });

  it('applique les raccourcis 30j, 90j et 1an avec les bonnes bornes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-12-31T08:00:00.000Z'));

    const onChange = vi.fn();
    render(
      <GlobalFiltersBar
        filters={{
          date_start: '2024-01-01',
          date_end: '2024-01-31',
        }}
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole('button', { name: '30j' }));
    fireEvent.click(screen.getByRole('button', { name: '90j' }));
    fireEvent.click(screen.getByRole('button', { name: '1an' }));

    expect(onChange).toHaveBeenNthCalledWith(1, {
      date_start: '2024-12-01',
      date_end: '2024-12-31',
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      date_start: '2024-10-02',
      date_end: '2024-12-31',
    });
    expect(onChange).toHaveBeenNthCalledWith(3, {
      date_start: '2024-01-01',
      date_end: '2024-12-31',
    });
  });

  it('peut être rendu dans un wrapper QueryClientProvider via renderHook sans erreur', async () => {
    const onChange = vi.fn();
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => (
        <GlobalFiltersBar
          filters={{
            date_start: '2024-03-01',
            date_end: '2024-03-31',
          }}
          onChange={onChange}
        />
      ),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    expect(result.current.props.filters).toEqual({
      date_start: '2024-03-01',
      date_end: '2024-03-31',
    });
  });
});