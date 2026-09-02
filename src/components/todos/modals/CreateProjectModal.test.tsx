import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockMutateAsync, mockUseCreateTodoProject, mockCn } = vi.hoisted(() => {
  const mockMutateAsyncFn = vi.fn();
  const mockUseCreateTodoProjectFn = vi.fn(() => ({
    mutateAsync: mockMutateAsyncFn,
    isPending: false,
    isError: false,
  }));
  const mockCnFn = vi.fn((...args: unknown[]) =>
    args
      .filter(Boolean)
      .map(String)
      .join(' ')
  );
  return {
    mockMutateAsync: mockMutateAsyncFn,
    mockUseCreateTodoProject: mockUseCreateTodoProjectFn,
    mockCn: mockCnFn,
  };
});

vi.mock('@/hooks/tasks/useTodoProjects', () => ({
  useCreateTodoProject: mockUseCreateTodoProject,
}));

vi.mock('@/components/ui/dialog', () => {
  const Dialog = ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="dialog-root" data-open={open} onClick={() => onOpenChange(open)}>
      {children}
    </div>
  );
  const DialogContent = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  );
  const DialogHeader = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  const DialogTitle = ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  );
  const DialogFooter = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
});

vi.mock('@/components/ui/button', () => {
  const Button = ({
    children,
    onClick,
    type,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
    disabled?: boolean;
    variant?: string;
  }) => (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
    >
      {children}
    </button>
  );
  return { Button };
});

vi.mock('@/components/ui/input', () => {
  const Input = ({
    id,
    value,
    onChange,
    placeholder,
    autoFocus,
    className,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={className}
    />
  );
  return { Input };
});

vi.mock('@/components/ui/textarea', () => {
  const Textarea = ({
    id,
    value,
    onChange,
    placeholder,
    className,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  );
  return { Textarea };
});

vi.mock('@/components/ui/label', () => {
  const Label = ({
    htmlFor,
    children,
  }: {
    htmlFor?: string;
    children: React.ReactNode;
  }) => <label htmlFor={htmlFor}>{children}</label>;
  return { Label };
});

vi.mock('@/components/ui/switch', () => {
  const Switch = ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange && onCheckedChange(!checked)}
    >
      {checked ? 'on' : 'off'}
    </button>
  );
  return { Switch };
});

vi.mock('lucide-react', () => {
  const Users = (props: { className?: string }) => (
    <svg data-icon="users" {...props} />
  );
  const Loader2 = (props: { className?: string }) => (
    <svg data-icon="loader2" {...props} />
  );
  return { Users, Loader2 };
});

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

import { CreateProjectModal } from './CreateProjectModal';

describe('CreateProjectModal', () => {
  it('affiche le formulaire quand open=true et initialise les valeurs', () => {
    const handleOpenChange = vi.fn();

    renderWithClient(
      <CreateProjectModal open={true} onOpenChange={handleOpenChange} />
    );

    expect(screen.getByText('Nouveau projet')).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Nom *') as HTMLInputElement;
    const descriptionInput = screen.getByLabelText(
      'Description'
    ) as HTMLTextAreaElement;

    expect(nameInput.value).toBe('');
    expect(descriptionInput.value).toBe('');
    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Créer' }) as HTMLButtonElement
    ).toBeDisabled();
  });

  it('appelle mutateAsync avec les bonnes valeurs et ferme le modal au succès', async () => {
    const handleOpenChange = vi.fn();
    mockMutateAsync.mockResolvedValueOnce({ id: 'p1' });

    renderWithClient(
      <CreateProjectModal open={true} onOpenChange={handleOpenChange} />
    );

    const nameInput = screen.getByLabelText('Nom *') as HTMLInputElement;
    const descriptionInput = screen.getByLabelText(
      'Description'
    ) as HTMLTextAreaElement;
    const switchButton = screen.getByRole('switch');
    const createButton = screen.getByRole('button', {
      name: 'Créer',
    }) as HTMLButtonElement;

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Projet test' } });
      fireEvent.change(descriptionInput, {
        target: { value: 'Une description' },
      });
      fireEvent.click(switchButton);
    });

    const allButtons = screen.getAllByRole('button');
    const colorButtons = allButtons.filter(
      (btn) =>
        !['Annuler', 'Créer', 'on', 'off'].includes(btn.textContent ?? '')
    );
    expect(colorButtons.length).toBeGreaterThan(0);

    const targetColorButton = colorButtons[0];

    await act(async () => {
      fireEvent.click(targetColorButton);
    });

    await act(async () => {
      fireEvent.click(createButton);
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    const callArg = mockMutateAsync.mock.calls[0][0];
    expect(callArg.name).toBe('Projet test');
    expect(callArg.description).toBe('Une description');
    expect(callArg.is_shared).toBe(true);
    expect(typeof callArg.color).toBe('string');
    expect(callArg.color.length).toBeGreaterThan(0);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(nameInput.value).toBe('');
    expect(descriptionInput.value).toBe('');
    expect(
      screen.getByRole('switch').getAttribute('aria-checked')
    ).toBe('false');
  });

  it("n’envoie pas la mutation si le nom est vide ou seulement des espaces", async () => {
    const handleOpenChange = vi.fn();
    mockMutateAsync.mockReset();

    renderWithClient(
      <CreateProjectModal open={true} onOpenChange={handleOpenChange} />
    );

    const nameInput = screen.getByLabelText('Nom *') as HTMLInputElement;
    const createButton = screen.getByRole('button', {
      name: 'Créer',
    }) as HTMLButtonElement;

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: '   ' } });
    });

    expect(createButton).toBeDisabled();

    await act(async () => {
      const form = createButton.closest('form');
      if (form) {
        fireEvent.submit(form);
      }
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it("désactive le bouton et affiche l'indicateur de chargement quand la mutation est en attente", async () => {
    mockUseCreateTodoProject.mockImplementationOnce(() => ({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
    }));

    const handleOpenChange = vi.fn();

    renderWithClient(
      <CreateProjectModal open={true} onOpenChange={handleOpenChange} />
    );

    const createButton = screen.getByRole('button', {
      name: 'Créer',
    }) as HTMLButtonElement;
    expect(createButton).toBeDisabled();
    expect(
      screen
        .getByTestId('dialog-content')
        .querySelector('[data-icon="loader2"]')
    ).toBeTruthy();
  });
});