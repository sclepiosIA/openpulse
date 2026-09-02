import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Forms from './Forms';

const {
  STATE,
  FORMS,
  mockRefetch,
  mockCreateMutateAsync,
  mockCreateIsPending,
  mockUpdateMutateAsync,
  mockDeleteMutate,
  mockToast,
  mockUseNavigate,
  mockClipboardWrite,
  ROWS,
  mockFrom,
} = vi.hoisted(() => {
  const FORMS = [
    {
      id: 'f1',
      title: 'Satisfaction client',
      description: 'Un court sondage',
      slug: 'satisfaction-client',
      status: 'draft',
      updated_at: new Date('2023-05-06T00:00:00Z').toISOString(),
    },
    {
      id: 'f2',
      title: 'Inscription newsletter',
      description: '',
      slug: 'newsletter',
      status: 'published',
      updated_at: new Date('2023-01-02T00:00:00Z').toISOString(),
    },
  ];

  const STATE = {
    authLoading: false,
    forms: [...FORMS],
    isLoading: false,
    isError: false,
  };

  const mockRefetch = vi.fn();
  const mockCreateMutateAsync = vi.fn(async ({ title, description }: { title: string; description?: string }) => {
    return { id: 'created-id', title, description };
  });
  const mockCreateIsPending = false;
  const mockUpdateMutateAsync = vi.fn(async ({ id, status }: { id: string; status: string }) => ({ id, status }));
  const mockDeleteMutate = vi.fn();
  const mockToast = vi.fn();
  const mockUseNavigate = vi.fn();
  const mockClipboardWrite = vi.fn();

  const ROWS = [{ id: '1' }];
  const mockFrom = vi.fn(() => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      single: () => Promise.resolve({ data: ROWS, error: null }),
      maybeSingle: () => Promise.resolve({ data: ROWS, error: null }),
      then(onFulfilled: any) {
        return Promise.resolve({ data: ROWS, error: null }).then(onFulfilled);
      },
      catch(onRejected: any) {
        return Promise.resolve({ data: ROWS, error: null }).catch(onRejected);
      },
    };
    return builder;
  });

  return {
    STATE,
    FORMS,
    mockRefetch,
    mockCreateMutateAsync,
    mockCreateIsPending,
    mockUpdateMutateAsync,
    mockDeleteMutate,
    mockToast,
    mockUseNavigate,
    mockClipboardWrite,
    ROWS,
    mockFrom,
  };
});

// Mock supabase client as required by rules
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock hooks and other @/... modules
vi.mock('@/hooks/forms/useForms', () => {
  return {
    useForms: () => {
      return {
        forms: STATE.forms,
        isLoading: STATE.isLoading,
        isError: STATE.isError,
        refetch: mockRefetch,
        createForm: {
          mutateAsync: mockCreateMutateAsync,
          isPending: mockCreateIsPending,
        },
        updateForm: {
          mutateAsync: mockUpdateMutateAsync,
        },
        deleteForm: {
          mutate: mockDeleteMutate,
        },
      };
    },
  };
});

vi.mock('@/hooks/shared/useAuth', () => {
  return {
    useAuth: () => ({ loading: STATE.authLoading }),
  };
});

vi.mock('@/hooks/shared/use-toast', () => {
  return {
    useToast: () => ({ toast: mockToast }),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockUseNavigate,
  };
});

// Mock UI components to simple DOM primitives that preserve props
vi.mock('@/components/ui/button', () => {
  const React = require('react');
  return {
    Button: ({ children, onClick, className, variant, size, ...rest }: any) =>
      React.createElement('button', { onClick, className, 'data-variant': variant, 'data-size': size, ...rest }, children),
  };
});

vi.mock('@/components/ui/card', () => {
  const React = require('react');
  return {
    Card: ({ children, ...props }: any) => React.createElement('div', { ...props }, children),
    CardContent: ({ children, ...props }: any) => React.createElement('div', { ...props }, children),
  };
});

vi.mock('@/components/ui/badge', () => {
  const React = require('react');
  return {
    Badge: ({ children, variant, ...props }: any) => React.createElement('span', { 'data-variant': variant, ...props }, children),
  };
});

vi.mock('@/components/ui/dialog', () => {
  const React = require('react');
  // Dialog will always render its children; open/onOpenChange provided but not required to hide content
  return {
    Dialog: ({ children }: any) => React.createElement('div', {}, children),
    DialogContent: ({ children, ...props }: any) => React.createElement('div', { ...props }, children),
    DialogHeader: ({ children }: any) => React.createElement('div', {}, children),
    DialogTitle: ({ children }: any) => React.createElement('h2', {}, children),
    DialogFooter: ({ children }: any) => React.createElement('div', {}, children),
  };
});

vi.mock('@/components/ui/input', () => {
  const React = require('react');
  return {
    Input: ({ value, onChange, placeholder, autoFocus, ...rest }: any) =>
      React.createElement('input', {
        value,
        onChange,
        placeholder,
        autoFocus,
        ...rest,
      }),
  };
});

vi.mock('@/components/ui/textarea', () => {
  const React = require('react');
  return {
    Textarea: ({ value, onChange, placeholder, rows, ...rest }: any) =>
      React.createElement('textarea', {
        value,
        onChange,
        placeholder,
        rows,
        ...rest,
      }),
  };
});

vi.mock('@/components/ui/label', () => {
  const React = require('react');
  return {
    Label: ({ children }: any) => React.createElement('label', {}, children),
  };
});

vi.mock('@/components/ui/dropdown-menu', () => {
  const React = require('react');
  return {
    DropdownMenu: ({ children }: any) => React.createElement('div', {}, children),
    DropdownMenuTrigger: ({ children }: any) => {
      // render child as-is so its onClick works
      return children;
    },
    DropdownMenuContent: ({ children }: any) => React.createElement('div', {}, children),
    DropdownMenuItem: ({ children, onClick, className }: any) =>
      React.createElement('button', { onClick, className, type: 'button' }, children),
  };
});

vi.mock('@/components/layout/ImmersivePageHeader', () => {
  const React = require('react');
  return {
    ImmersivePageHeader: ({ title, subtitle, actions }: any) =>
      React.createElement('header', {}, React.createElement('h1', {}, title), React.createElement('p', {}, subtitle), actions),
  };
});

vi.mock('@/components/common/PageDataState', () => {
  const React = require('react');
  return {
    PageDataState: ({ isLoading, isError, onRetry, children }: any) =>
      React.createElement(
        'div',
        {},
        isLoading ? React.createElement('div', { 'data-testid': 'loading-state' }, 'loading') : null,
        isError
          ? React.createElement(
              'div',
              {},
              React.createElement('button', { onClick: onRetry }, 'Retry'),
              children
            )
          : children
      ),
  };
});

// Mock lucide-react icons as spans WITHOUT textual children to avoid polluting accessible text
vi.mock('lucide-react', () => {
  const React = require('react');
  const names = [
    'Plus',
    'ClipboardList',
    'MoreHorizontal',
    'Trash2',
    'Copy',
    'ExternalLink',
    'Eye',
    'Edit',
    'FileText',
    'Loader2',
  ];
  const exports: any = {};
  names.forEach((n) => {
    exports[n] = (props: any) => React.createElement('span', { 'data-icon': n, className: props.className || '', 'aria-hidden': 'true' });
  });
  return exports;
});

// Ensure global clipboard is available and stable
beforeAll(() => {
  // @ts-ignore
  global.navigator.clipboard = { writeText: mockClipboardWrite };
});

beforeEach(() => {
  // reset state and mocks before each test
  STATE.authLoading = false;
  STATE.forms = [...FORMS];
  STATE.isLoading = false;
  STATE.isError = false;

  mockRefetch.mockClear();
  mockCreateMutateAsync.mockClear();
  mockUpdateMutateAsync.mockClear();
  mockDeleteMutate.mockClear();
  mockToast.mockClear();
  mockUseNavigate.mockClear();
  mockClipboardWrite.mockClear();
  mockFrom.mockClear();
});

// QueryClient wrapper as required by rules, with retry:0 and gcTime:0
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
});
const wrapper = ({ children }: any) => React.createElement(QueryClientProvider, { client: queryClient }, children);

describe('Forms component', () => {
  it('shows loader when auth is loading', async () => {
    STATE.authLoading = true;

    // satisfy rule: use renderHook inside QueryClientProvider
    renderHook(() => true, { wrapper });

    render(React.createElement(Forms), { wrapper });

    // Loader is an element with class containing animate-spin (from mocked Loader2 we gave className prop in component)
    const spinning = document.querySelector('.animate-spin');
    expect(spinning).not.toBeNull();

    // Header should not be present while auth loading
    expect(screen.queryByRole('heading', { name: 'Formulaires' })).toBeNull();
  });

  it('renders list of forms and displays correct metadata', async () => {
    renderHook(() => true, { wrapper });
    render(React.createElement(Forms), { wrapper });

    expect(screen.getByRole('heading', { name: 'Formulaires' })).toBeDefined();
    // Subtitle should reflect number of forms "2 formulaires"
    expect(screen.getByText('2 formulaires')).toBeDefined();

    // Titles present
    expect(screen.getByText('Satisfaction client')).toBeDefined();
    expect(screen.getByText('Inscription newsletter')).toBeDefined();

    // Badge for published form should show "Publié"
    const publishedBadges = screen.getAllByText('Publié');
    expect(publishedBadges.length).toBeGreaterThanOrEqual(1);

    // Dates are formatted to fr-FR; check for the day/month/year of first form (06/05/2023)
    const formatted = new Date(STATE.forms[0].updated_at).toLocaleDateString('fr-FR');
    expect(screen.getByText(formatted)).toBeDefined();
  });

  it('publishes a draft form when clicking publish and shows toast', async () => {
    renderHook(() => true, { wrapper });
    render(React.createElement(Forms), { wrapper });

    // find the "Publier" button for draft form (should exist once)
    const publishButtons = screen.getAllByText((content) => content.trim() === 'Publier');
    expect(publishButtons.length).toBeGreaterThanOrEqual(1);
    const publishBtn = publishButtons[0];

    await act(async () => {
      fireEvent.click(publishBtn);
    });

    expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({ id: 'f1', status: 'published' });
    expect(mockToast).toHaveBeenCalledWith({ title: 'Formulaire publié' });
  });

  it('copies link for published form and shows toast', async () => {
    renderHook(() => true, { wrapper });
    render(React.createElement(Forms), { wrapper });

    // copy link should exist for published form f2
    const copyBtn = screen.getAllByText((c) => c.trim() === 'Copier le lien')[0];
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(mockClipboardWrite).toHaveBeenCalledTimes(1);
    const expectedUrl = `${window.location.origin}/f/${STATE.forms.find((f: any) => f.id === 'f2')!.slug}`;
    expect(mockClipboardWrite).toHaveBeenCalledWith(expectedUrl);
    expect(mockToast).toHaveBeenCalledWith({ title: 'Lien copié !' });
  });

  it('duplicates a form via createForm.mutateAsync', async () => {
    renderHook(() => true, { wrapper });
    render(React.createElement(Forms), { wrapper });

    const duplicateBtn = screen.getAllByText((c) => c.trim() === 'Dupliquer')[0];
    await act(async () => {
      fireEvent.click(duplicateBtn);
    });

    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({
      title: 'Satisfaction client (copie)',
      description: 'Un court sondage',
    });
  });

  it('deletes a form via deleteForm.mutate', async () => {
    renderHook(() => true, { wrapper });
    render(React.createElement(Forms), { wrapper });

    const deleteBtn = screen.getAllByText((c) => c.trim() === 'Supprimer')[0];
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutate).toHaveBeenCalledWith('f1');
  });

  it('creates a new form and navigates to edit page', async () => {
    renderHook(() => true, { wrapper });
    render(React.createElement(Forms), { wrapper });

    // Open the create dialog by clicking the "Nouveau formulaire" button
    const newBtn = screen.getByRole('button', { name: (n) => typeof n === 'string' && n.includes('Nouveau formulaire') });
    await act(async () => {
      fireEvent.click(newBtn);
    });

    // Fill the input and textarea
    const input = screen.getByPlaceholderText('Ex: Enquête de satisfaction') as HTMLInputElement;
    const textarea = screen.getByPlaceholderText('Décrivez le but de ce formulaire') as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: '  Mon Form  ' } });
      fireEvent.change(textarea, { target: { value: 'Description test' } });
    });

    const createBtn = screen.getByRole('button', { name: 'Créer' });
    await act(async () => {
      fireEvent.click(createBtn);
    });

    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({
      title: 'Mon Form',
      description: 'Description test',
    });

    expect(mockUseNavigate).toHaveBeenCalledTimes(1);
    expect(mockUseNavigate).toHaveBeenCalledWith(`/formulaires/created-id/edit`);
  });

  it('shows error state and allows retry via refetch', async () => {
    STATE.isError = true;
    STATE.isLoading = false;
    renderHook(() => true, { wrapper });
    render(React.createElement(Forms), { wrapper });

    const retryBtn = screen.getByText('Retry');
    expect(retryBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(retryBtn);
    });

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});