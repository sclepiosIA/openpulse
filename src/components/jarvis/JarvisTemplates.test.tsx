import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import React from 'react';

const {
  MOCK_TEMPLATES,
  mockUseJarvisTemplates,
} = vi.hoisted(() => {
  const MOCK_TEMPLATES = [
    {
      id: 't1',
      name: 'Email de relance',
      description: 'Relancer un prospect après un premier contact',
      action_type: 'send_email',
      template_data: { subject: 'Relance', body: 'Bonjour {{name}}' },
      variables: ['name'],
      is_system: false,
    },
    {
      id: 't2',
      name: 'Tâche de suivi',
      description: 'Créer une tâche de suivi',
      action_type: 'create_task',
      template_data: { title: 'Suivi {{client}}' },
      variables: ['client'],
      is_system: true,
    },
  ];

  const mockUseJarvisTemplates = vi.fn().mockReturnValue({
    templates: MOCK_TEMPLATES,
    isLoading: false,
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    useTemplate: vi.fn(),
    duplicateTemplate: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  });

  return {
    MOCK_TEMPLATES,
    mockUseJarvisTemplates,
  };
});

vi.mock('@/hooks/jarvis/useJarvisTemplates', () => ({
  useJarvisTemplates: mockUseJarvisTemplates,
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => {
    const { children, ...rest } = props;
    return <button {...rest}>{children}</button>;
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  CardContent: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: React.HTMLAttributes<HTMLDivElement>) => <span {...props} />,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="skeleton" {...props} />,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: (props: React.HTMLAttributes<HTMLDivElement> & { defaultValue?: string }) => (
    <div {...props} />
  ),
  TabsContent: (props: React.HTMLAttributes<HTMLDivElement> & { value: string }) => (
    <div {...props} />
  ),
  TabsList: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  TabsTrigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) => {
    const { children, ...rest } = props;
    return <button {...rest}>{children}</button>;
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  DialogContent: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  DialogDescription: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  DialogFooter: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  DialogHeader: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  DialogTitle: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: (props: { children: React.ReactNode; onValueChange?: (value: string) => void }) => (
    <div>{props.children}</div>
  ),
  SelectContent: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  SelectItem: (props: React.HTMLAttributes<HTMLDivElement> & { value: string }) => (
    <div {...props} />
  ),
  SelectTrigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const { children, ...rest } = props;
    return <button {...rest}>{children}</button>;
  },
  SelectValue: (props: { placeholder?: string }) => <span>{props.placeholder}</span>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  AlertDialogAction: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const { children, ...rest } = props;
    return <button {...rest}>{children}</button>;
  },
  AlertDialogCancel: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const { children, ...rest } = props;
    return <button {...rest}>{children}</button>;
  },
  AlertDialogContent: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  AlertDialogDescription: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  AlertDialogFooter: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  AlertDialogHeader: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  AlertDialogTitle: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  AlertDialogTrigger: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  TooltipContent: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  TooltipTrigger: (props: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{props.children}</div>
  ),
}));

vi.mock('framer-motion', () => {
  const MockDiv: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...rest }) => (
    <div {...rest}>{children}</div>
  );
  return {
    motion: {
      div: MockDiv,
    },
    AnimatePresence: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) =>
    classes.filter(Boolean).join(' '),
}));

vi.mock('./JarvisMemoryManager', () => ({
  JarvisMemoryManager: () => <div>Jarvis Memory Manager</div>,
}));

vi.mock('@/types/jarvis', () => ({}));

const { mockFrom } = vi.hoisted(() => {
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
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: vi.fn((onFulfilled: (value: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    ),
    catch: vi.fn((onRejected: (reason: unknown) => void) => Promise.reject(null).catch(onRejected)),
  };

  const mockFrom = vi.fn(() => builder);

  return { mockFrom };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('lucide-react', () => {
  const Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <svg {...props} />;
  return {
    FileText: Icon,
    Plus: Icon,
    Trash2: Icon,
    Edit2: Icon,
    Copy: Icon,
    Mail: Icon,
    CheckSquare: Icon,
    Calendar: Icon,
    MessageSquare: Icon,
    Sparkles: Icon,
    Lock: Icon,
    Loader2: Icon,
    Brain: Icon,
  };
});

function createWrapper(children: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

import { JarvisTemplates } from './JarvisTemplates';

describe('JarvisTemplates component', () => {
  it('affiche les skeletons en mode chargement', () => {
    mockUseJarvisTemplates.mockReturnValueOnce({
      templates: [],
      isLoading: true,
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      useTemplate: vi.fn(),
      duplicateTemplate: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    });

    render(createWrapper(<JarvisTemplates />));

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('affiche les templates et le compteur lorsque le chargement est terminé', () => {
    mockUseJarvisTemplates.mockReturnValue({
      templates: MOCK_TEMPLATES,
      isLoading: false,
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      useTemplate: vi.fn(),
      duplicateTemplate: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    });

    render(createWrapper(<JarvisTemplates />));

    expect(screen.getByText('Templates Jarvis')).toBeInTheDocument();
    expect(
      screen.getByText(`${MOCK_TEMPLATES.length} templates disponibles`),
    ).toBeInTheDocument();

    expect(screen.getByText('Email de relance')).toBeInTheDocument();
    expect(screen.getByText('Tâche de suivi')).toBeInTheDocument();
  });

  it('affiche un message lorsqu’il n’y a aucun template', () => {
    mockUseJarvisTemplates.mockReturnValue({
      templates: [],
      isLoading: false,
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      useTemplate: vi.fn(),
      duplicateTemplate: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    });

    render(createWrapper(<JarvisTemplates />));

    expect(screen.getByText('Aucun template')).toBeInTheDocument();
    expect(
      screen.getByText('Créez votre premier template pour automatiser vos actions'),
    ).toBeInTheDocument();
  });

  it('appelle useTemplate avec le bon id quand on clique sur Utiliser ce template', async () => {
    const useTemplateMock = vi.fn().mockResolvedValue(undefined);

    mockUseJarvisTemplates.mockReturnValue({
      templates: MOCK_TEMPLATES,
      isLoading: false,
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      useTemplate: useTemplateMock,
      duplicateTemplate: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    });

    render(createWrapper(<JarvisTemplates />));

    const useButtons = screen.getAllByLabelText('Copier');
    expect(useButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(useButtons[0]);
    });

    expect(useTemplateMock).toHaveBeenCalledWith(MOCK_TEMPLATES[0].id);
  });

  it('appelle duplicateTemplate pour un template système lorsqu’on clique sur Dupliquer', async () => {
    const duplicateMock = vi.fn().mockResolvedValue(undefined);

    mockUseJarvisTemplates.mockReturnValue({
      templates: MOCK_TEMPLATES,
      isLoading: false,
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      useTemplate: vi.fn(),
      duplicateTemplate: duplicateMock,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    });

    render(createWrapper(<JarvisTemplates />));

    const duplicateButtons = screen.getAllByLabelText('Ajouter');
    expect(duplicateButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(duplicateButtons[0]);
    });

    expect(duplicateMock).toHaveBeenCalledWith(MOCK_TEMPLATES[1].id);
  });

  it('appelle deleteTemplate avec le bon id après confirmation', async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);

    mockUseJarvisTemplates.mockReturnValue({
      templates: [MOCK_TEMPLATES[0]],
      isLoading: false,
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: deleteMock,
      useTemplate: vi.fn(),
      duplicateTemplate: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    });

    render(createWrapper(<JarvisTemplates />));

    const deleteOpenButtons = screen.getAllByLabelText('Supprimer');
    expect(deleteOpenButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(deleteOpenButtons[0]);
    });

    const confirmButtons = screen.getAllByText('Supprimer');
    // Le premier est probablement dans la liste, le dernier dans la modal
    const confirmButton = confirmButtons[confirmButtons.length - 1];

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith(MOCK_TEMPLATES[0].id);
    });
  });

  it('prépare un nouveau template quand on clique sur Nouveau', async () => {
    const createTemplateMock = vi.fn().mockResolvedValue(undefined);

    mockUseJarvisTemplates.mockReturnValue({
      templates: MOCK_TEMPLATES,
      isLoading: false,
      createTemplate: createTemplateMock,
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      useTemplate: vi.fn(),
      duplicateTemplate: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    });

    render(createWrapper(<JarvisTemplates />));

    const newButton = screen.getByText('Nouveau');

    await act(async () => {
      fireEvent.click(newButton);
    });

    const nameInputs = screen.getAllByRole('textbox');
    expect(nameInputs.length).toBeGreaterThan(0);
  });
});