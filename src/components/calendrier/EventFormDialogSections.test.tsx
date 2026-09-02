import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { COLORS, CALS } = vi.hoisted(() => ({
  COLORS: ['#ff6961', '#77dd77', '#84b6f4'],
  CALS: [
    { id: 'cal1', name: 'Perso', color: '#aabbcc' },
    { id: 'cal2', name: 'Work', color: '#112233' },
  ],
}));

vi.mock('@/types/calendar', () => ({
  CALENDAR_COLORS: COLORS,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon =
    ({ className }: { className?: string }) =>
      React.createElement('span', { 'data-icon': true, className });
  return {
    Check: Icon,
    Flag: Icon,
    UserCheck: Icon,
    Trash2: Icon,
    Copy: Icon,
  };
});

vi.mock('@/components/ui/input', () => {
  const ReactInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => React.createElement('input', { ...props, ref })
  );
  ReactInput.displayName = 'Input';
  return { Input: ReactInput };
});

vi.mock('@/components/ui/button', () => {
  const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; asChild?: boolean }) =>
    React.createElement('button', { ...props }, props.children);
  return { Button };
});

vi.mock('@/components/ui/label', () => {
  const Label = (props: React.LabelHTMLAttributes<HTMLLabelElement>) =>
    React.createElement('label', { ...props }, props.children);
  return { Label };
});

vi.mock('@/components/ui/switch', () => {
  const Switch = (props: { id?: string; checked?: boolean; onCheckedChange?: (v: boolean) => void }) =>
    React.createElement('input', {
      type: 'checkbox',
      id: props.id,
      role: 'checkbox',
      checked: !!props.checked,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => props.onCheckedChange?.(e.target.checked),
    });
  return { Switch };
});

vi.mock('@/components/ui/popover', () => {
  const Popover = ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children);
  const PopoverTrigger = ({ children }: { children?: React.ReactNode; asChild?: boolean }) => React.createElement(React.Fragment, null, children);
  const PopoverContent = ({ children }: { children?: React.ReactNode }) => React.createElement('div', { 'data-popover-content': true }, children);
  return { Popover, PopoverContent, PopoverTrigger };
});

vi.mock('@/components/ui/select', () => {
  const ReactCtx = React.createContext<{ value: string; onValueChange: (v: string) => void } | null>(null);

  const Select = ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children?: React.ReactNode }) =>
    React.createElement(ReactCtx.Provider, { value: { value, onValueChange } }, children);

  const SelectTrigger = ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement('div', { className }, children);

  const SelectContent = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { role: 'listbox' }, children);

  const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) => {
    const ctx = React.useContext(ReactCtx);
    return React.createElement(
      'button',
      { type: 'button', onClick: () => ctx?.onValueChange(value) },
      children
    );
  };

  const SelectValue = ({ placeholder }: { placeholder?: string }) => {
    const ctx = React.useContext(ReactCtx);
    return React.createElement('span', { 'data-select-value': true }, ctx?.value || placeholder || '');
  };

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

vi.mock('@/components/ui/tooltip', () => {
  const Tooltip = ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children);
  const TooltipTrigger = ({ children }: { children?: React.ReactNode; asChild?: boolean }) => React.createElement(React.Fragment, null, children);
  const TooltipContent = ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children);
  return { Tooltip, TooltipTrigger, TooltipContent };
});

vi.mock('./CategorySelector', () => ({
  CategorySelector: () => null,
}));

import { EventFormHero, EventFormDisplayAvailability, EventFormFooter } from './EventFormDialogSections';

describe('EventFormHero', () => {
  it('renders and handles title change, calendar selection, and color selection', async () => {
    const user = userEvent.setup();

    const titleInputRef = React.createRef<HTMLInputElement>();
    const setTitle = vi.fn();
    const setCalendarId = vi.fn();
    const setColor = vi.fn();

    render(
      <EventFormHero
        titleInputRef={titleInputRef}
        title=""
        setTitle={setTitle}
        calendars={CALS}
        calendarId="cal1"
        setCalendarId={setCalendarId}
        color={null}
        setColor={setColor}
      />
    );

    const titleInput = screen.getByPlaceholderText("Titre de l'événement *") as HTMLInputElement;
    expect(titleInput.value).toBe('');
    await user.type(titleInput, 'New Title');
    expect(setTitle).toHaveBeenCalled();
    const calls = setTitle.mock.calls.map((c) => c[0]);
    expect(calls.length).toBeGreaterThanOrEqual('New Title'.length);
    expect(calls.join('')).toBe('New Title');

    const workItem = screen.getByRole('button', { name: /Work/i });
    await user.click(workItem);
    expect(setCalendarId).toHaveBeenCalledWith('cal2');

    expect(screen.getByText('Couleur auto')).toBeTruthy();

    const colorBtn = screen.getByRole('button', { name: `Couleur ${COLORS[1]}` });
    await user.click(colorBtn);
    expect(setColor).toHaveBeenCalledWith(COLORS[1]);

    const autoBtn = screen.getByRole('button', { name: 'Couleur automatique' });
    await user.click(autoBtn);
    expect(setColor).toHaveBeenCalledWith(null);
  });

  it('shows "Couleur" when a color is set', () => {
    const setTitle = vi.fn();
    const setCalendarId = vi.fn();
    const setColor = vi.fn();

    render(
      <EventFormHero
        titleInputRef={React.createRef<HTMLInputElement>()}
        title="X"
        setTitle={setTitle}
        calendars={CALS}
        calendarId="cal1"
        setCalendarId={setCalendarId}
        color={COLORS[0]}
        setColor={setColor}
      />
    );

    expect(screen.getByText('Couleur')).toBeTruthy();
  });
});

describe('EventFormDisplayAvailability', () => {
  it('toggles banner and switches availability', async () => {
    const user = userEvent.setup();
    const setDisplayAsBanner = vi.fn();
    const setAvailability = vi.fn();

    render(
      <EventFormDisplayAvailability
        displayAsBanner={false}
        setDisplayAsBanner={setDisplayAsBanner}
        availability="busy"
        setAvailability={setAvailability}
      />
    );

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    await user.click(checkbox);
    expect(setDisplayAsBanner).toHaveBeenCalledWith(true);

    const disponibleBtn = screen.getByRole('button', { name: 'Disponible' });
    await user.click(disponibleBtn);
    expect(setAvailability).toHaveBeenCalledWith('free');

    const occupeBtn = screen.getByRole('button', { name: 'Occupé' });
    await user.click(occupeBtn);
    expect(setAvailability).toHaveBeenCalledWith('busy');
  });
});

describe('EventFormFooter', () => {
  it('editing mode: triggers delete, duplicate, cancel, and submit', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    render(
      <EventFormFooter
        isEditing
        isSaving={false}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: "Supprimer l'événement" });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
    await user.click(deleteButtons[0]);
    await user.click(deleteButtons[1]);
    expect(onDelete).toHaveBeenCalledTimes(2);

    const duplicateButtons = screen.getAllByRole('button', { name: "Dupliquer l'événement" });
    expect(duplicateButtons.length).toBeGreaterThanOrEqual(2);
    await user.click(duplicateButtons[0]);
    await user.click(duplicateButtons[1]);
    expect(onDuplicate).toHaveBeenCalledTimes(2);

    const cancelBtn = screen.getByRole('button', { name: 'Annuler' });
    await user.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);

    const saveBtn = screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
    await user.click(saveBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('create mode: handles saving disabled state', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <EventFormFooter
        isEditing={false}
        isSaving={false}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );

    const createBtn = screen.getByRole('button', { name: 'Créer' }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
    await user.click(createBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(
      <EventFormFooter
        isEditing={false}
        isSaving
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );

    const createBtnDisabled = screen.getByRole('button', { name: 'Créer' }) as HTMLButtonElement;
    expect(createBtnDisabled.disabled).toBe(true);
  });
});