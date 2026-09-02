import { render, screen, fireEvent } from '@testing-library/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { CalendarSidebar } from './CalendarSidebar';

const {
  CALENDARS,
  EMPTY_ARRAY,
  mockUseCalendars,
  mockCreateMutateAsync,
  mockDeleteMutateAsync,
  mockToast,
  mockMutateAsync,
} = vi.hoisted(() => ({
  CALENDARS: [
    { id: 'cal-1', name: 'Mon agenda', color: '#3b82f6', type: 'personal', is_default: true },
    { id: 'cal-2', name: 'Équipe médicale', color: '#8b5cf6', type: 'team', is_default: false },
  ],
  EMPTY_ARRAY: [] as unknown[],
  mockUseCalendars: vi.fn(),
  mockCreateMutateAsync: vi.fn(),
  mockDeleteMutateAsync: vi.fn(),
  mockToast: vi.fn(),
  mockMutateAsync: vi.fn(),
}));

vi.mock('@/hooks/calendar/useCalendars', () => ({
  useCalendars: mockUseCalendars,
  useCreateCalendar: () => ({ mutateAsync: mockCreateMutateAsync, isPending: false }),
  useDeleteCalendar: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
}));

vi.mock('@/hooks/hr/useTeamCalendars', () => ({
  useTeamCalendars: () => ({ data: EMPTY_ARRAY, isLoading: false }),
}));

vi.mock('@/hooks/bookings/useMarqueTeamCalendars', () => ({
  useMarqueTeamCalendars: () => ({ data: EMPTY_ARRAY, isLoading: false }),
}));

vi.mock('@/hooks/calendar/useCalendarSubscriptions', () => ({
  useCalendarSubscriptions: () => ({ data: EMPTY_ARRAY, isLoading: false }),
  useSyncCalendarSubscription: () => ({ mutateAsync: mockMutateAsync, mutate: vi.fn(), isPending: false }),
  useDeleteCalendarSubscription: () => ({ mutateAsync: mockMutateAsync, mutate: vi.fn(), isPending: false }),
  useToggleSubscriptionActive: () => ({ mutateAsync: mockMutateAsync, mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('./AvailabilityQuickAdd', () => ({
  AvailabilityQuickAdd: () => null,
}));

vi.mock('@/types/calendar', () => ({
  CALENDAR_COLORS: ['#3b82f6', '#ef4444', '#10b981'],
}));

vi.mock('@/components/ui/button', async () => {
  const React = await import('react');
  const Button = ({
    children,
    onClick,
    disabled,
  }: PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) =>
    React.createElement('button', { onClick, disabled }, children);
  return { Button, buttonVariants: () => '' };
});

vi.mock('@/components/ui/checkbox', async () => {
  const React = await import('react');
  const Checkbox = ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
  }) =>
    React.createElement('input', {
      type: 'checkbox',
      checked: !!checked,
      onChange: () => onCheckedChange?.(),
    });
  return { Checkbox };
});

vi.mock('@/components/ui/scroll-area', async () => {
  const React = await import('react');
  const Pass = ({ children }: PropsWithChildren) => React.createElement('div', null, children);
  return { ScrollArea: Pass, ScrollBar: Pass };
});

vi.mock('@/components/ui/badge', async () => {
  const React = await import('react');
  const Badge = ({ children }: PropsWithChildren) =>
    React.createElement('span', { 'data-testid': 'badge' }, children);
  return { Badge, badgeVariants: () => '' };
});

vi.mock('@/components/ui/collapsible', () => {
  const Pass = ({ children }: PropsWithChildren): ReactNode => children;
  return { Collapsible: Pass, CollapsibleTrigger: Pass, CollapsibleContent: Pass };
});

vi.mock('@/components/ui/avatar', () => {
  const Pass = ({ children }: PropsWithChildren): ReactNode => children;
  return { Avatar: Pass, AvatarFallback: Pass };
});

vi.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }: PropsWithChildren): ReactNode => children;
  return {
    Dialog: Pass,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogTrigger: Pass,
  };
});

vi.mock('@/components/ui/alert-dialog', () => {
  const Pass = ({ children }: PropsWithChildren): ReactNode => children;
  return {
    AlertDialog: Pass,
    AlertDialogAction: Pass,
    AlertDialogCancel: Pass,
    AlertDialogContent: Pass,
    AlertDialogDescription: Pass,
    AlertDialogFooter: Pass,
    AlertDialogHeader: Pass,
    AlertDialogTitle: Pass,
  };
});

vi.mock('@/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: PropsWithChildren): ReactNode => children;
  return {
    DropdownMenu: Pass,
    DropdownMenuContent: Pass,
    DropdownMenuItem: Pass,
    DropdownMenuTrigger: Pass,
  };
});

vi.mock('@/components/ui/input', async () => {
  const React = await import('react');
  const Input = (props: { id?: string; value?: string; placeholder?: string }) =>
    React.createElement('input', props);
  return { Input };
});

vi.mock('@/components/ui/label', async () => {
  const React = await import('react');
  const Label = ({ children }: PropsWithChildren) =>
    React.createElement('label', null, children);
  return { Label };
});

vi.mock('@/components/ui/select', () => {
  const Pass = ({ children }: PropsWithChildren): ReactNode => children;
  return {
    Select: Pass,
    SelectContent: Pass,
    SelectItem: Pass,
    SelectTrigger: Pass,
    SelectValue: () => null,
  };
});

function makeProps(overrides: Partial<Parameters<typeof CalendarSidebar>[0]> = {}) {
  return {
    selectedCalendarIds: ['cal-1'],
    onCalendarToggle: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    ...overrides,
  };
}

describe('CalendarSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCalendars.mockReturnValue({ data: CALENDARS, isLoading: false });
  });

  it('affiche les calendriers groupés par type avec leurs noms', () => {
    render(<CalendarSidebar {...makeProps()} />);

    expect(screen.getByText('Mon agenda')).toBeTruthy();
    expect(screen.getByText('Équipe médicale')).toBeTruthy();
    expect(screen.getByText('Personnels')).toBeTruthy();
    expect(screen.getByText('Équipe')).toBeTruthy();
    expect(screen.getByText('Créer')).toBeTruthy();
  });

  it('affiche le badge "Défaut" pour le calendrier par défaut uniquement', () => {
    render(<CalendarSidebar {...makeProps()} />);

    const defaultBadges = screen.getAllByText('Défaut');
    expect(defaultBadges).toHaveLength(1);
  });

  it('affiche le compteur de calendriers sélectionnés dans le groupe', () => {
    render(<CalendarSidebar {...makeProps({ selectedCalendarIds: ['cal-1'] })} />);

    expect(screen.getByText('1')).toBeTruthy();
  });

  it('appelle onCalendarToggle avec le bon id au clic sur un calendrier', () => {
    const props = makeProps();
    render(<CalendarSidebar {...props} />);

    fireEvent.click(screen.getByText('Mon agenda'));
    expect(props.onCalendarToggle).toHaveBeenCalledWith('cal-1');

    fireEvent.click(screen.getByText('Équipe médicale'));
    expect(props.onCalendarToggle).toHaveBeenCalledWith('cal-2');
  });

  it('affiche "Tout" et appelle onSelectAll quand tout n’est pas sélectionné', () => {
    const props = makeProps({ selectedCalendarIds: [] });
    render(<CalendarSidebar {...props} />);

    const btn = screen.getByText('Tout');
    fireEvent.click(btn);
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
    expect(props.onDeselectAll).not.toHaveBeenCalled();
  });

  it('affiche "Masquer" et appelle onDeselectAll quand tous les calendriers sont sélectionnés', () => {
    const props = makeProps({ selectedCalendarIds: ['cal-1', 'cal-2'] });
    render(<CalendarSidebar {...props} />);

    const btn = screen.getByText('Masquer');
    fireEvent.click(btn);
    expect(props.onDeselectAll).toHaveBeenCalledTimes(1);
    expect(props.onSelectAll).not.toHaveBeenCalled();
  });

  it('affiche l’état vide "Aucun calendrier" quand la liste est vide et non en chargement', () => {
    mockUseCalendars.mockReturnValue({ data: EMPTY_ARRAY, isLoading: false });
    render(<CalendarSidebar {...makeProps({ selectedCalendarIds: [] })} />);

    expect(screen.getByText('Aucun calendrier')).toBeTruthy();
    expect(screen.getByText('Créer un calendrier')).toBeTruthy();
  });

  it('n’affiche pas l’état vide pendant le chargement', () => {
    mockUseCalendars.mockReturnValue({ data: undefined, isLoading: true });
    render(<CalendarSidebar {...makeProps({ selectedCalendarIds: [] })} />);

    expect(screen.queryByText('Aucun calendrier')).toBeNull();
    expect(screen.queryByText('Mon agenda')).toBeNull();
  });
});