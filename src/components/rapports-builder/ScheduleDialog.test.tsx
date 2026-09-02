/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { ScheduleDialog } from './ScheduleDialog';

const {
  SCHEDULES,
  DASHBOARD,
  AUTH_STATE,
  mockFrom,
  mockUseScheduledExports,
  mockUseUpsertScheduledExport,
  mockUseDeleteScheduledExport,
  mockUpsertMutateAsync,
  mockDeleteMutate,
  mockOnOpenChange,
} = vi.hoisted(() => {
  const schedules = [
    {
      id: 'sch-1',
      dashboard_id: 'dash-1',
      format: 'pdf',
      frequency: 'weekly',
      hour_utc: 6,
      day_of_week: 1,
      day_of_month: 1,
      recipients: ['alpha@example.com', 'beta@example.com'],
      is_active: true,
      next_run_at: '2024-06-12T06:00:00.000Z',
      last_status: 'success',
    },
  ];

  return {
    SCHEDULES: schedules,
    DASHBOARD: {
      id: 'dash-1',
      name: 'Dashboard test',
    },
    AUTH_STATE: {
      user: { id: 'u1', email: 'test@example.com' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockFrom: vi.fn(),
    mockUseScheduledExports: vi.fn(),
    mockUseUpsertScheduledExport: vi.fn(),
    mockUseDeleteScheduledExport: vi.fn(),
    mockUpsertMutateAsync: vi.fn(),
    mockDeleteMutate: vi.fn(),
    mockOnOpenChange: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
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
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
      catch: vi.fn(() => builder),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    ariaLabel,
    'aria-label': ariaLabelProp,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    ariaLabel?: string;
    'aria-label'?: string;
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} aria-label={ariaLabelProp ?? ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
    min,
    max,
    className,
    onKeyDown,
  }: {
    value?: string | number;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
    min?: number;
    max?: number;
    className?: string;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      min={min}
      max={max}
      className={className}
      onKeyDown={onKeyDown}
    />
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      aria-label="switch"
      data-checked={checked ? 'true' : 'false'}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? 'on' : 'off'}
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="select-root" data-value={value}>
      <select
        aria-label="select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {React.Children.toArray(children).filter((child) => React.isValidElement(child) && child.type === 'option')}
      </select>
      <div>{React.Children.toArray(children).filter((child) => !(React.isValidElement(child) && child.type === 'option'))}</div>
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('lucide-react', () => ({
  Trash2: () => <svg data-testid="trash-icon" />,
  Plus: () => <svg data-testid="plus-icon" />,
  Calendar: () => <svg data-testid="calendar-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));

vi.mock('@/hooks/analytics/useScheduledExports', () => ({
  useScheduledExports: mockUseScheduledExports,
  useUpsertScheduledExport: mockUseUpsertScheduledExport,
  useDeleteScheduledExport: mockUseDeleteScheduledExport,
}));

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

describe('ScheduleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseScheduledExports.mockReturnValue({
      data: SCHEDULES,
      isLoading: false,
      isError: false,
      error: null,
    });

    mockUseUpsertScheduledExport.mockReturnValue({
      mutateAsync: mockUpsertMutateAsync,
      isPending: false,
    });

    mockUseDeleteScheduledExport.mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    });

    mockUpsertMutateAsync.mockResolvedValue({ data: null, error: null });
  });

  it('expose les données du hook via renderHook avec QueryClientProvider', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => mockUseScheduledExports(DASHBOARD.id), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(SCHEDULES);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data[0].format).toBe('pdf');
    expect(result.current.data[0].recipients).toHaveLength(2);
  });

  it('affiche les planifications existantes et permet la suppression', () => {
    render(
      <ScheduleDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        dashboard={DASHBOARD}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Planifier l'envoi automatique")).toBeInTheDocument();
    expect(screen.getByText('weekly')).toBeInTheDocument();
    expect(screen.getByText('2 destinataires · dernier : success')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutate).toHaveBeenCalledWith('sch-1');
  });

  it('permet de créer une planification et sauvegarde les valeurs métier attendues', async () => {
    render(
      <ScheduleDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        dashboard={DASHBOARD}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole('button', { name: /Nouvelle planification/i }));

    const saveButtonInitially = screen.getByRole('button', { name: 'Enregistrer' });
    expect(saveButtonInitially).toBeDisabled();

    const emailInput = screen.getByPlaceholderText('email@exemple.com');
    fireEvent.change(emailInput, { target: { value: 'client@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => {
      expect(screen.getByText('client@example.com')).toBeInTheDocument();
    });

    const numberInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(numberInputs[0], { target: { value: '9' } });

    fireEvent.click(screen.getByRole('button', { name: 'switch' }));

    const saveButton = screen.getByRole('button', { name: 'Enregistrer' });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpsertMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockUpsertMutateAsync).toHaveBeenCalledWith({
      dashboard_id: 'dash-1',
      format: 'pdf',
      frequency: 'weekly',
      hour_utc: 9,
      day_of_week: 1,
      day_of_month: 1,
      recipients: ['client@example.com'],
      is_active: false,
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument();
    });
  });

  it('n’ajoute pas un email invalide et empêche la sauvegarde sans destinataire', () => {
    mockUseScheduledExports.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <ScheduleDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        dashboard={DASHBOARD}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Aucune planification active')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Nouvelle planification/i }));
    fireEvent.change(screen.getByPlaceholderText('email@exemple.com'), { target: { value: 'invalide' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(screen.queryByText('invalide')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('reflète un état d’erreur du hook', async () => {
    const wrapper = createWrapper();

    mockUseScheduledExports.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    });

    const { result } = renderHook(() => mockUseScheduledExports(DASHBOARD.id), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.data).toBeNull();
  });
});