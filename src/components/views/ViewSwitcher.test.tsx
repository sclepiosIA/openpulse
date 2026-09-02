import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import type {
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
  SVGAttributes,
  MouseEventHandler,
  InputHTMLAttributes,
  LabelHTMLAttributes,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ViewSwitcher, type ViewSwitcherProps } from './ViewSwitcher';

const HOISTED = vi.hoisted(() => {
  const ownViews = [
    {
      id: 'own-1',
      name: 'Vue prioritaire',
      user_id: 'u1',
      is_shared: false,
      is_default: true,
      filters: [],
      sort: [],
      columns: ['name', 'email'],
      view_type: 'table',
    },
    {
      id: 'own-2',
      name: 'Pipeline personnel',
      user_id: 'u1',
      is_shared: true,
      is_default: false,
      filters: [],
      sort: [],
      columns: ['company'],
      view_type: 'kanban',
    },
  ];

  const sharedViews = [
    {
      id: 'shared-1',
      name: 'Comptes partagés',
      user_id: null,
      is_shared: true,
      is_default: false,
      filters: [],
      sort: [],
      columns: ['name'],
      view_type: 'table',
    },
  ];

  return {
    OWN_VIEWS: ownViews,
    SHARED_VIEWS: sharedViews,
    entityViewsState: {
      ownViews,
      sharedViews,
      views: [...ownViews, ...sharedViews],
      isMutating: false,
    },
    createViewMock: vi.fn(),
    updateViewMock: vi.fn(),
    deleteViewMock: vi.fn(),
    setDefaultViewMock: vi.fn(),
    toastMock: vi.fn(),
  };
});

vi.mock('@/hooks/views/useEntityViews', () => ({
  useEntityViews: vi.fn(() => ({
    ownViews: HOISTED.entityViewsState.ownViews,
    sharedViews: HOISTED.entityViewsState.sharedViews,
    views: HOISTED.entityViewsState.views,
    createView: HOISTED.createViewMock,
    updateView: HOISTED.updateViewMock,
    deleteView: HOISTED.deleteViewMock,
    setDefaultView: HOISTED.setDefaultViewMock,
    isMutating: HOISTED.entityViewsState.isMutating,
  })),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: HOISTED.toastMock,
  })),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', async () => {
  const ReactModule = await import('react');

  const makeIcon = (name: string) => {
    const Icon = (props: SVGAttributes<SVGSVGElement>) =>
      ReactModule.createElement('svg', {
        'data-testid': `icon-${name}`,
        'aria-hidden': 'true',
        ...props,
      });
    Icon.displayName = name;
    return Icon;
  };

  return {
    ChevronDown: makeIcon('ChevronDown'),
    Plus: makeIcon('Plus'),
    Star: makeIcon('Star'),
    Trash2: makeIcon('Trash2'),
    Users: makeIcon('Users'),
    User: makeIcon('User'),
    Check: makeIcon('Check'),
    Save: makeIcon('Save'),
  };
});

vi.mock('@/components/ui/button', async () => {
  const ReactModule = await import('react');

  type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    asChild?: boolean;
  };

  const Button = ReactModule.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, variant: _variant, size: _size, asChild: _asChild, ...props }, ref) =>
      ReactModule.createElement('button', { ref, ...props }, children),
  );
  Button.displayName = 'Button';

  return {
    Button,
    buttonVariants: vi.fn(),
  };
});

vi.mock('@/components/ui/badge', async () => {
  const ReactModule = await import('react');

  type BadgeProps = HTMLAttributes<HTMLDivElement> & {
    variant?: string;
  };

  const Badge = ReactModule.forwardRef<HTMLDivElement, BadgeProps>(
    ({ children, variant: _variant, ...props }, ref) =>
      ReactModule.createElement('div', { ref, ...props }, children),
  );
  Badge.displayName = 'Badge';

  return {
    Badge,
    badgeVariants: vi.fn(),
  };
});

vi.mock('@/components/ui/dropdown-menu', async () => {
  const ReactModule = await import('react');

  type ChildrenProps = {
    children?: ReactNode;
  };

  type SelectEvent = {
    preventDefault: () => void;
  };

  type DivBaseProps = Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'>;

  type ItemProps = DivBaseProps & {
    onSelect?: (event: SelectEvent) => void;
    disabled?: boolean;
  };

  const DropdownMenu = ({ children }: ChildrenProps) => ReactModule.createElement('div', null, children);

  const DropdownMenuTrigger = ({ children }: ChildrenProps & { asChild?: boolean }) =>
    ReactModule.createElement(ReactModule.Fragment, null, children);

  const DropdownMenuContent = ReactModule.forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement> & { align?: string }
  >(({ children, align: _align, ...props }, ref) =>
    ReactModule.createElement('div', { ref, role: 'menu', ...props }, children),
  );
  DropdownMenuContent.displayName = 'DropdownMenuContent';

  const DropdownMenuItem = ReactModule.forwardRef<HTMLDivElement, ItemProps>(
    ({ children, onClick, onSelect, disabled, ...props }, ref) => {
      const handleClick: MouseEventHandler<HTMLDivElement> = (event) => {
        onClick?.(event);
        if (!disabled) {
          onSelect?.({ preventDefault: () => event.preventDefault() });
        }
      };

      return ReactModule.createElement(
        'div',
        {
          ref,
          role: 'menuitem',
          tabIndex: 0,
          'aria-disabled': disabled ? 'true' : undefined,
          ...props,
          onClick: handleClick,
        },
        children,
      );
    },
  );
  DropdownMenuItem.displayName = 'DropdownMenuItem';

  const DropdownMenuSeparator = ReactModule.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    (props, ref) => ReactModule.createElement('div', { ref, role: 'separator', ...props }),
  );
  DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

  const DropdownMenuLabel = ReactModule.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => ReactModule.createElement('div', { ref, ...props }, children),
  );
  DropdownMenuLabel.displayName = 'DropdownMenuLabel';

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
  };
});

vi.mock('@/components/ui/dialog', async () => {
  const ReactModule = await import('react');

  const DialogOpenContext = ReactModule.createContext(false);

  type DialogProps = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: ReactNode;
  };

  const Dialog = ({ open = false, children }: DialogProps) =>
    ReactModule.createElement(DialogOpenContext.Provider, { value: open }, children);

  const DialogContent = ReactModule.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => {
      const open = ReactModule.useContext(DialogOpenContext);
      if (!open) return null;

      return ReactModule.createElement('div', { ref, role: 'dialog', ...props }, children);
    },
  );
  DialogContent.displayName = 'DialogContent';

  const DialogHeader = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    ReactModule.createElement('div', props, children);

  const DialogFooter = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    ReactModule.createElement('div', props, children);

  const DialogTitle = ReactModule.forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
    ({ children, ...props }, ref) => ReactModule.createElement('h2', { ref, ...props }, children),
  );
  DialogTitle.displayName = 'DialogTitle';

  const DialogOverlay = ReactModule.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) =>
    ReactModule.createElement('div', { ref, ...props }),
  );
  DialogOverlay.displayName = 'DialogOverlay';

  const DialogDescription = ReactModule.forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
    ({ children, ...props }, ref) => ReactModule.createElement('p', { ref, ...props }, children),
  );
  DialogDescription.displayName = 'DialogDescription';

  return {
    Dialog,
    DialogPortal: ({ children }: { children?: ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    DialogOverlay,
    DialogClose: ({ children }: { children?: ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    DialogTrigger: ({ children }: { children?: ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
  };
});

vi.mock('@/components/ui/input', async () => {
  const ReactModule = await import('react');

  const Input = ReactModule.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => ReactModule.createElement('input', { ref, ...props }),
  );
  Input.displayName = 'Input';

  return { Input };
});

vi.mock('@/components/ui/label', async () => {
  const ReactModule = await import('react');

  const Label = ReactModule.forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
    ({ children, ...props }, ref) => ReactModule.createElement('label', { ref, ...props }, children),
  );
  Label.displayName = 'Label';

  return { Label };
});

vi.mock('@/components/ui/switch', async () => {
  const ReactModule = await import('react');

  type SwitchProps = {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  };

  const Switch = ({ id, checked = false, onCheckedChange }: SwitchProps) =>
    ReactModule.createElement('button', {
      id,
      type: 'button',
      role: 'switch',
      'aria-checked': checked,
      onClick: () => onCheckedChange?.(!checked),
    });

  return { Switch };
});

const baseCurrentState: ViewSwitcherProps['currentState'] = {
  filters: [],
  sort: [],
  columns: ['name', 'email'],
  view_type: 'table' as ViewSwitcherProps['currentState']['view_type'],
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderSwitcher(options: {
  activeViewId?: string | null;
  currentState?: ViewSwitcherProps['currentState'];
  className?: string;
} = {}) {
  const queryClient = createQueryClient();
  const onApplyViewMock = vi.fn();
  const onApplyView: ViewSwitcherProps['onApplyView'] = (view) => {
    onApplyViewMock(view);
  };

  const props: ViewSwitcherProps = {
    entity: 'contacts',
    currentState: options.currentState ?? baseCurrentState,
    activeViewId: options.activeViewId ?? null,
    onApplyView,
    className: options.className,
  };

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ViewSwitcher {...props} />
    </QueryClientProvider>,
  );

  return { ...rendered, onApplyViewMock };
}

beforeEach(() => {
  HOISTED.entityViewsState.ownViews = HOISTED.OWN_VIEWS;
  HOISTED.entityViewsState.sharedViews = HOISTED.SHARED_VIEWS;
  HOISTED.entityViewsState.views = [...HOISTED.OWN_VIEWS, ...HOISTED.SHARED_VIEWS];
  HOISTED.entityViewsState.isMutating = false;

  HOISTED.createViewMock.mockReset();
  HOISTED.updateViewMock.mockReset();
  HOISTED.deleteViewMock.mockReset();
  HOISTED.setDefaultViewMock.mockReset();
  HOISTED.toastMock.mockReset();

  HOISTED.createViewMock.mockResolvedValue('missing-created-view');
  HOISTED.updateViewMock.mockResolvedValue(undefined);
  HOISTED.deleteViewMock.mockResolvedValue(undefined);
  HOISTED.setDefaultViewMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ViewSwitcher', () => {
  it('affiche les vues disponibles et applique une vue personnelle ou la vue Toutes', () => {
    const { onApplyViewMock } = renderSwitcher();

    expect(screen.getByRole('button', { name: /Toutes 3/ })).toBeInTheDocument();
    expect(screen.getByText('Mes vues')).toBeInTheDocument();
    expect(screen.getByText('Vue prioritaire')).toBeInTheDocument();
    expect(screen.getByText('Pipeline personnel')).toBeInTheDocument();
    expect(screen.getByText('Vues partagées équipe')).toBeInTheDocument();
    expect(screen.getByText('Comptes partagés')).toBeInTheDocument();
    expect(screen.queryByTitle("Enregistrer l'état courant dans cette vue")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Toutes (sans filtre sauvegardé)'));
    expect(onApplyViewMock).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByText('Vue prioritaire'));
    const firstOwnView = HOISTED.OWN_VIEWS[0];
    if (firstOwnView === undefined) throw new Error('Vue personnelle manquante');
    expect(onApplyViewMock).toHaveBeenCalledWith(firstOwnView);
  });

  it("met à jour la vue active avec l'état courant", async () => {
    renderSwitcher({ activeViewId: 'own-1' });

    expect(screen.getByRole('button', { name: /Vue prioritaire 3/ })).toBeInTheDocument();

    const saveButton = screen.getByTitle("Enregistrer l'état courant dans cette vue");
    expect(saveButton).toBeEnabled();

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(HOISTED.updateViewMock).toHaveBeenCalledWith({
        id: 'own-1',
        patch: {
          filters: baseCurrentState.filters,
          sort: baseCurrentState.sort,
          columns: baseCurrentState.columns,
          view_type: baseCurrentState.view_type,
        },
      });
    });

    expect(HOISTED.toastMock).toHaveBeenCalledWith({
      title: 'Vue mise à jour',
      description: '"Vue prioritaire" reflète l\'état courant.',
    });
  });

  it('supprime une vue active et revient à Toutes', async () => {
    const { onApplyViewMock } = renderSwitcher({ activeViewId: 'own-1' });

    const deleteButtons = screen.getAllByTitle('Supprimer');
    const firstDeleteButton = deleteButtons[0];
    if (firstDeleteButton === undefined) throw new Error('Bouton de suppression manquant');

    await act(async () => {
      fireEvent.click(firstDeleteButton);
    });

    await waitFor(() => {
      expect(HOISTED.deleteViewMock).toHaveBeenCalledWith('own-1');
    });

    expect(HOISTED.toastMock).toHaveBeenCalledWith({ title: 'Vue supprimée' });
    expect(onApplyViewMock).toHaveBeenCalledWith(null);
  });

  it('définit une vue comme vue par défaut', async () => {
    renderSwitcher();

    const defaultButtons = screen.getAllByTitle('Définir par défaut');
    const secondDefaultButton = defaultButtons[1];
    if (secondDefaultButton === undefined) throw new Error('Bouton de vue par défaut manquant');

    await act(async () => {
      fireEvent.click(secondDefaultButton);
    });

    await waitFor(() => {
      expect(HOISTED.setDefaultViewMock).toHaveBeenCalledWith('own-2');
    });

    expect(HOISTED.toastMock).toHaveBeenCalledWith({
      title: 'Vue par défaut',
      description: '"Pipeline personnel" sera chargée par défaut.',
    });
  });

  it('crée une vue partagée par défaut à partir de l’état courant', async () => {
    vi.useFakeTimers();
    HOISTED.createViewMock.mockResolvedValueOnce('own-1');

    const { onApplyViewMock } = renderSwitcher();

    fireEvent.click(screen.getByText("Nouvelle vue à partir de l'état courant"));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer la vue' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Vue chaude' } });

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);

    const sharedSwitch = switches[0];
    const defaultSwitch = switches[1];
    if (sharedSwitch === undefined || defaultSwitch === undefined) throw new Error('Interrupteurs de création manquants');

    fireEvent.click(sharedSwitch);
    fireEvent.click(defaultSwitch);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer la vue' }));
      await Promise.resolve();
    });

    expect(HOISTED.createViewMock).toHaveBeenCalledWith({
      name: 'Vue chaude',
      is_shared: true,
      is_default: true,
      filters: baseCurrentState.filters,
      sort: baseCurrentState.sort,
      columns: baseCurrentState.columns,
      view_type: baseCurrentState.view_type,
    });

    expect(HOISTED.toastMock).toHaveBeenCalledWith({
      title: 'Vue créée',
      description: '"Vue chaude" est maintenant disponible.',
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    const firstOwnView = HOISTED.OWN_VIEWS[0];
    if (firstOwnView === undefined) throw new Error('Vue créée introuvable');
    expect(onApplyViewMock).toHaveBeenCalledWith(firstOwnView);
  });

  it('affiche un toast destructif quand la création échoue', async () => {
    HOISTED.createViewMock.mockRejectedValueOnce(new Error('boom'));

    renderSwitcher();

    fireEvent.click(screen.getByText("Nouvelle vue à partir de l'état courant"));
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Vue erreur' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer la vue' }));
    });

    await waitFor(() => {
      expect(HOISTED.toastMock).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'boom',
        variant: 'destructive',
      });
    });
  });

  it('désactive les actions de sauvegarde et de création pendant une mutation', () => {
    HOISTED.entityViewsState.isMutating = true;

    renderSwitcher({ activeViewId: 'own-1' });

    expect(screen.getByTitle("Enregistrer l'état courant dans cette vue")).toBeDisabled();

    fireEvent.click(screen.getByText("Nouvelle vue à partir de l'état courant"));
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Vue bloquée' } });

    expect(screen.getByRole('button', { name: 'Créer la vue' })).toBeDisabled();
  });
});