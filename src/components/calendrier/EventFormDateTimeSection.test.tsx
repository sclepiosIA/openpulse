import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventFormDateTimeSection } from './EventFormDateTimeSection';

const {
  STABLE_USER,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
  CALENDAR_RESULT_DATE,
} = vi.hoisted(() => {
  const resolved = { data: null, error: null };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => resolved),
    maybeSingle: vi.fn(async () => resolved),
    then: (onFulfilled: (value: typeof resolved) => unknown) => Promise.resolve(resolved).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(resolved).catch(onRejected),
  };

  return {
    STABLE_USER: {
      user: { id: 'u1', email: 'test@example.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockFrom: vi.fn(() => builder),
    mockNavigate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    CALENDAR_RESULT_DATE: new Date('2024-06-20T00:00:00.000Z'),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => STABLE_USER,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => STABLE_USER,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => STABLE_USER,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('lucide-react', () => ({
  CalendarIcon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="calendar-icon" {...props} />,
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="clock-icon" {...props} />,
  Repeat: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="repeat-icon" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked: boolean;
    onCheckedChange: (value: boolean) => void;
    id?: string;
  }) => (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
    >
      {checked ? 'on' : 'off'}
    </button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode; className?: string; align?: string }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    selected,
    onSelect,
  }: {
    selected?: Date;
    onSelect?: (date: Date | undefined) => void;
  }) => (
    <button
      type="button"
      data-testid={`calendar-${selected ? selected.toISOString().slice(0, 10) : 'empty'}`}
      onClick={() => onSelect?.(CALENDAR_RESULT_DATE)}
    >
      calendar
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => {
  const ReactModule = React;

  const SelectContext = ReactModule.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode;
      value?: string;
      onValueChange?: (value: string) => void;
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <button type="button" className={className}>
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => {
      const ctx = ReactModule.useContext(SelectContext);
      return <span>{ctx.value ?? placeholder ?? ''}</span>;
    },
    SelectContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const ctx = ReactModule.useContext(SelectContext);
      return (
        <button type="button" aria-label={`Sélectionner ${value}`} onClick={() => ctx.onValueChange?.(value)}>
          {children}
        </button>
      );
    },
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('EventFormDateTimeSection', () => {
  const defaultProps = () => ({
    startDate: new Date('2024-01-15T10:00:00.000Z'),
    setStartDate: vi.fn(),
    startTime: '09:00',
    setStartTime: vi.fn(),
    endDate: new Date('2024-01-16T12:00:00.000Z'),
    setEndDate: vi.fn(),
    endTime: '10:30',
    setEndTime: vi.fn(),
    allDay: false,
    setAllDay: vi.fn(),
    isRecurring: false,
    setIsRecurring: vi.fn(),
    recurrenceRule: '',
    setRecurrenceRule: vi.fn(),
    durationLabel: '1h30',
    timeOptions: [
      { value: '09:00', label: '09:00' },
      { value: '10:30', label: '10:30' },
      { value: '14:00', label: '14:00' },
    ],
  });

  it('affiche les valeurs métier attendues et permet de modifier dates, heures et switches', () => {
    const props = defaultProps();
    const Wrapper = createWrapper();

    render(<EventFormDateTimeSection {...props} />, { wrapper: Wrapper });

    expect(screen.getByText('Date et heure')).toBeInTheDocument();
    expect(screen.getByText('· 1h30')).toBeInTheDocument();
    expect(screen.getByText('15 janv.')).toBeInTheDocument();
    expect(screen.getByText('16 janv.')).toBeInTheDocument();
    expect(screen.getAllByText('09:00').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('10:30').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Journée entière')).toBeInTheDocument();
    expect(screen.getByText('Récurrent')).toBeInTheDocument();

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);

    fireEvent.click(switches[0]);
    expect(props.setAllDay).toHaveBeenCalledWith(true);

    fireEvent.click(switches[1]);
    expect(props.setIsRecurring).toHaveBeenCalledWith(true);

    const calendars = screen.getAllByText('calendar');
    fireEvent.click(calendars[0]);
    expect(props.setStartDate).toHaveBeenCalledWith(CALENDAR_RESULT_DATE);

    fireEvent.click(calendars[1]);
    expect(props.setEndDate).toHaveBeenCalledWith(CALENDAR_RESULT_DATE);

    const timeInputs = document.querySelectorAll<HTMLInputElement>('input[type="time"]');
    fireEvent.change(timeInputs[0], { target: { value: '14:00' } });
    expect(props.setStartTime).toHaveBeenCalledWith('14:00');

    fireEvent.change(timeInputs[1], { target: { value: '09:00' } });
    expect(props.setEndTime).toHaveBeenCalledWith('09:00');
  });

  it('masque les sélecteurs d’heure quand allDay est actif et affiche les règles de récurrence quand isRecurring est actif', () => {
    const props = {
      ...defaultProps(),
      allDay: true,
      isRecurring: true,
      recurrenceRule: 'FREQ=WEEKLY',
    };
    const Wrapper = createWrapper();

    render(<EventFormDateTimeSection {...props} />, { wrapper: Wrapper });

    expect(screen.queryByText('09:00')).not.toBeInTheDocument();
    expect(screen.queryByText('10:30')).not.toBeInTheDocument();

    expect(screen.getByText('Toutes les semaines')).toBeInTheDocument();
    expect(screen.getByText('Tous les jours')).toBeInTheDocument();
    expect(screen.getByText('Toutes les 2 semaines')).toBeInTheDocument();
    expect(screen.getByText('Jours ouvrés')).toBeInTheDocument();
    expect(screen.getByText('Tous les week-ends')).toBeInTheDocument();
    expect(screen.getByText('Week-ends 1 sem./2')).toBeInTheDocument();
    expect(screen.getByText('Tous les mois')).toBeInTheDocument();
    expect(screen.getByText('Tous les trimestres')).toBeInTheDocument();
    expect(screen.getByText('Tous les ans')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tous les ans'));
    expect(props.setRecurrenceRule).toHaveBeenCalledWith('FREQ=YEARLY');
  });

  it('n’affiche pas le sélecteur de fréquence si la récurrence est désactivée', () => {
    const props = {
      ...defaultProps(),
      isRecurring: false,
    };
    const Wrapper = createWrapper();

    render(<EventFormDateTimeSection {...props} />, { wrapper: Wrapper });

    expect(screen.queryByText('Tous les jours')).not.toBeInTheDocument();
    expect(screen.queryByText('Toutes les semaines')).not.toBeInTheDocument();
    expect(screen.queryByText('Fréquence')).not.toBeInTheDocument();
  });
});