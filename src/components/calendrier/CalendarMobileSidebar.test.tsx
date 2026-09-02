import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CalendarMobileSidebar } from './CalendarMobileSidebar';

const { ROWS, mockFrom, mockSheetState, mockButtonProps, mockCalendarSidebarProps, mockSlidersProps } =
  vi.hoisted(() => ({
    ROWS: [{ id: 'r1' }],
    mockFrom: vi.fn(),
    mockSheetState: {
      open: false,
      onOpenChange: vi.fn<(open: boolean) => void>(),
    },
    mockCalendarSidebarProps: vi.fn(),
    mockButtonProps: vi.fn(),
    mockSlidersProps: vi.fn(),
  }));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant,
    size,
    className,
    ...props
  }: React.PropsWithChildren<{
    variant?: string;
    size?: string;
    className?: string;
  }>) => {
    mockButtonProps({ variant, size, className, props });
    return (
      <button data-testid="mobile-sidebar-trigger" {...props}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({
    children,
    open,
    onOpenChange,
  }: React.PropsWithChildren<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>) => {
    mockSheetState.open = open;
    mockSheetState.onOpenChange = onOpenChange;
    return <div data-testid="sheet-root">{children}</div>;
  },
  SheetTrigger: ({
    children,
    asChild,
  }: React.PropsWithChildren<{ asChild?: boolean }>) => (
    <div data-testid="sheet-trigger" data-as-child={String(asChild)}>
      {children}
    </div>
  ),
  SheetContent: ({
    children,
    side,
    className,
  }: React.PropsWithChildren<{ side?: string; className?: string }>) =>
    mockSheetState.open ? (
      <div data-testid="sheet-content" data-side={side} data-class={className}>
        {children}
      </div>
    ) : null,
  SheetHeader: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="sheet-header" data-class={className}>
      {children}
    </div>
  ),
  SheetTitle: ({ children }: React.PropsWithChildren) => (
    <h2 data-testid="sheet-title">{children}</h2>
  ),
}));

vi.mock('./CalendarSidebar', () => ({
  CalendarSidebar: (props: {
    selectedCalendarIds: string[];
    onCalendarToggle: (id: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    showEstablishmentTasks?: boolean;
    onToggleEstablishmentTasks?: () => void;
    establishmentTaskCount?: number;
  }) => {
    mockCalendarSidebarProps(props);
    return (
      <div data-testid="calendar-sidebar">
        <div data-testid="selected-ids">{props.selectedCalendarIds.join(',')}</div>
        <div data-testid="establishment-visible">
          {String(props.showEstablishmentTasks)}
        </div>
        <div data-testid="establishment-count">
          {String(props.establishmentTaskCount)}
        </div>
        <button onClick={() => props.onCalendarToggle('cal-2')}>toggle-cal-2</button>
        <button onClick={() => props.onSelectAll()}>select-all</button>
        <button onClick={() => props.onDeselectAll()}>deselect-all</button>
        <button onClick={() => props.onToggleEstablishmentTasks?.()}>
          toggle-establishment
        </button>
      </div>
    );
  },
}));

vi.mock('lucide-react', () => ({
  SlidersHorizontal: (props: { className?: string }) => {
    mockSlidersProps(props);
    return <svg data-testid="sliders-icon" data-class={props.className} />;
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('CalendarMobileSidebar', () => {
  beforeEach(() => {
    mockButtonProps.mockClear();
    mockCalendarSidebarProps.mockClear();
    mockSlidersProps.mockClear();
    mockSheetState.open = false;
    mockSheetState.onOpenChange.mockClear?.();
  });

  it('renders the trigger button with expected UI props and closed sheet by default', () => {
    const onCalendarToggle = vi.fn();
    const onSelectAll = vi.fn();
    const onDeselectAll = vi.fn();

    render(
      <CalendarMobileSidebar
        selectedCalendarIds={['cal-1']}
        onCalendarToggle={onCalendarToggle}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
      />,
      { wrapper }
    );

    expect(screen.getByTestId('mobile-sidebar-trigger')).toHaveTextContent('Calendriers');
    expect(screen.getByTestId('sheet-trigger')).toHaveAttribute('data-as-child', 'true');
    expect(screen.queryByTestId('sheet-content')).not.toBeInTheDocument();

    expect(mockButtonProps).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'outline',
        size: 'sm',
        className: 'lg:hidden',
      })
    );

    expect(mockSlidersProps).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'h-4 w-4 mr-2',
      })
    );
  });

  it('opens the sheet when onOpenChange is triggered and displays header and sidebar content with forwarded business props', () => {
    const onCalendarToggle = vi.fn();
    const onSelectAll = vi.fn();
    const onDeselectAll = vi.fn();
    const onToggleEstablishmentTasks = vi.fn();

    const { rerender } = render(
      <CalendarMobileSidebar
        selectedCalendarIds={['cal-1', 'cal-3']}
        onCalendarToggle={onCalendarToggle}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        showEstablishmentTasks={true}
        onToggleEstablishmentTasks={onToggleEstablishmentTasks}
        establishmentTaskCount={7}
      />
    , { wrapper });

    fireEvent.click(screen.getByTestId('mobile-sidebar-trigger'));
    expect(mockSheetState.onOpenChange).toBeTypeOf('function');

    mockSheetState.onOpenChange(true);

    rerender(
      <CalendarMobileSidebar
        selectedCalendarIds={['cal-1', 'cal-3']}
        onCalendarToggle={onCalendarToggle}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        showEstablishmentTasks={true}
        onToggleEstablishmentTasks={onToggleEstablishmentTasks}
        establishmentTaskCount={7}
      />
    , { wrapper });

    expect(screen.getByTestId('sheet-content')).toHaveAttribute('data-side', 'left');
    expect(screen.getByTestId('sheet-content')).toHaveAttribute('data-class', 'w-80 p-0');
    expect(screen.getByTestId('sheet-header')).toHaveAttribute('data-class', 'p-4 border-b');
    expect(screen.getByTestId('sheet-title')).toHaveTextContent('Calendriers');

    expect(screen.getByTestId('calendar-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('selected-ids')).toHaveTextContent('cal-1,cal-3');
    expect(screen.getByTestId('establishment-visible')).toHaveTextContent('true');
    expect(screen.getByTestId('establishment-count')).toHaveTextContent('7');

    expect(mockCalendarSidebarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedCalendarIds: ['cal-1', 'cal-3'],
        onSelectAll,
        onDeselectAll,
        showEstablishmentTasks: true,
        onToggleEstablishmentTasks,
        establishmentTaskCount: 7,
      })
    );
  });

  it('forwards interaction callbacks from CalendarSidebar to parent handlers with the real payloads', () => {
    const onCalendarToggle = vi.fn();
    const onSelectAll = vi.fn();
    const onDeselectAll = vi.fn();
    const onToggleEstablishmentTasks = vi.fn();

    const { rerender } = render(
      <CalendarMobileSidebar
        selectedCalendarIds={['cal-9']}
        onCalendarToggle={onCalendarToggle}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        showEstablishmentTasks={false}
        onToggleEstablishmentTasks={onToggleEstablishmentTasks}
        establishmentTaskCount={2}
      />
    , { wrapper });

    mockSheetState.onOpenChange(true);

    rerender(
      <CalendarMobileSidebar
        selectedCalendarIds={['cal-9']}
        onCalendarToggle={onCalendarToggle}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        showEstablishmentTasks={false}
        onToggleEstablishmentTasks={onToggleEstablishmentTasks}
        establishmentTaskCount={2}
      />
    , { wrapper });

    fireEvent.click(screen.getByText('toggle-cal-2'));
    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByText('deselect-all'));
    fireEvent.click(screen.getByText('toggle-establishment'));

    expect(onCalendarToggle).toHaveBeenCalledTimes(1);
    expect(onCalendarToggle).toHaveBeenCalledWith('cal-2');
    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onDeselectAll).toHaveBeenCalledTimes(1);
    expect(onToggleEstablishmentTasks).toHaveBeenCalledTimes(1);
  });

  it('supports optional establishment props being omitted without crashing and forwards undefined values', () => {
    const onCalendarToggle = vi.fn();
    const onSelectAll = vi.fn();
    const onDeselectAll = vi.fn();

    const { rerender } = render(
      <CalendarMobileSidebar
        selectedCalendarIds={[]}
        onCalendarToggle={onCalendarToggle}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
      />
    , { wrapper });

    mockSheetState.onOpenChange(true);

    rerender(
      <CalendarMobileSidebar
        selectedCalendarIds={[]}
        onCalendarToggle={onCalendarToggle}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
      />
    , { wrapper });

    expect(screen.getByTestId('selected-ids')).toHaveTextContent('');
    expect(screen.getByTestId('establishment-visible')).toHaveTextContent('undefined');
    expect(screen.getByTestId('establishment-count')).toHaveTextContent('undefined');

    expect(mockCalendarSidebarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedCalendarIds: [],
        showEstablishmentTasks: undefined,
        onToggleEstablishmentTasks: undefined,
        establishmentTaskCount: undefined,
      })
    );
  });
});