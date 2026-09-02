import React, { createContext, useContext, PropsWithChildren } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { VERSIONS, mockUseWorkflowVersions, mockUseRestoreWorkflowVersion, mockMutateAsync, toast, mockFrom, supabase } = vi.hoisted(() => {
  const VERSIONS = [
    {
      id: 'ver1',
      version_number: 1,
      nom: 'Première version',
      created_at: '2023-04-14T10:00:00.000Z',
      graph: { nodes: [{ id: 'n1' }], edges: [] },
      trigger_type: 'manual',
      comment: 'init',
    },
    {
      id: 'ver2',
      version_number: 2,
      nom: 'Deuxième version',
      created_at: '2023-05-01T12:00:00.000Z',
      graph: { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [{ id: 'e1' }] },
      trigger_type: 'webhook',
      comment: 'fix',
    },
  ];
  const mockUseWorkflowVersions = vi.fn();
  const mockMutateAsync = vi.fn();
  const mockUseRestoreWorkflowVersion = vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false }));
  const toast = { success: vi.fn(), error: vi.fn() };

  interface Builder {
    select: (...args: unknown[]) => Builder;
    eq: (...args: unknown[]) => Builder;
    gte: (...args: unknown[]) => Builder;
    lte: (...args: unknown[]) => Builder;
    in: (...args: unknown[]) => Builder;
    order: (...args: unknown[]) => Builder;
    limit: (...args: unknown[]) => Builder;
    insert: (...args: unknown[]) => Builder;
    update: (...args: unknown[]) => Builder;
    delete: (...args: unknown[]) => Builder;
    single: () => Promise<{ data: unknown; error: null }>;
    maybeSingle: () => Promise<{ data: unknown; error: null }>;
    then: <TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ) => Promise<TResult1 | TResult2>;
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null
    ) => Promise<TResult>;
  }
  const builder: Builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve({ data: {}, error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (...args) => Promise.resolve({ data: {}, error: null }).then(...args);
  builder.catch = (...args) => Promise.resolve({ data: {}, error: null }).catch(...args);
  const mockFrom = vi.fn((_table?: string) => builder);
  const supabase = {
    from: mockFrom,
    rpc: vi.fn(() => builder),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })),
      onAuthStateChange: vi.fn(),
    },
  };

  return { VERSIONS, mockUseWorkflowVersions, mockUseRestoreWorkflowVersion, mockMutateAsync, toast, mockFrom, supabase };
});

vi.mock('@/hooks/workflows/useWorkflowVersions', () => ({
  useWorkflowVersions: (id?: string) => mockUseWorkflowVersions(id),
  useRestoreWorkflowVersion: () => mockUseRestoreWorkflowVersion(),
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase }));

vi.mock('sonner', () => ({ toast }));

vi.mock('lucide-react', () => ({
  History: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-history" {...props} />,
  RotateCcw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-rotate" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...rest }: PropsWithChildren<React.ComponentProps<'button'>>) => <button {...rest}>{children}</button>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...rest }: PropsWithChildren<React.ComponentProps<'span'>>) => <span {...rest}>{children}</span>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...rest }: PropsWithChildren<React.ComponentProps<'div'>>) => <div {...rest}>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => {
  type CtxType = { open?: boolean; onOpenChange?: (open: boolean) => void };
  const Ctx = createContext<CtxType>({});
  const Dialog = ({
    open,
    onOpenChange,
    children,
  }: PropsWithChildren<{ open?: boolean; onOpenChange?: (o: boolean) => void }>) => (
    <div data-testid="dialog">
      <Ctx.Provider value={{ open, onOpenChange }}>{children}</Ctx.Provider>
    </div>
  );
  const DialogTrigger = ({ children }: PropsWithChildren<{ asChild?: boolean }>) => {
    const ctx = useContext(Ctx);
    const child = children as React.ReactElement;
    const handleClick = (e: unknown) => {
      const c: unknown = child;
      const props = (c as React.ReactElement).props as { onClick?: (ev: unknown) => void };
      if (props && typeof props.onClick === 'function') {
        props.onClick(e);
      }
      if (ctx.onOpenChange) ctx.onOpenChange(true);
    };
    return React.cloneElement(child, { onClick: handleClick });
  };
  const DialogContent = ({ children, ...rest }: PropsWithChildren<React.ComponentProps<'div'>>) => (
    <div data-testid="dialog-content" {...rest}>
      {children}
    </div>
  );
  const DialogHeader = ({ children, ...rest }: PropsWithChildren<React.ComponentProps<'div'>>) => <div {...rest}>{children}</div>;
  const DialogTitle = ({ children, ...rest }: PropsWithChildren<React.ComponentProps<'div'>>) => <div {...rest}>{children}</div>;
  const DialogDescription = ({ children, ...rest }: PropsWithChildren<React.ComponentProps<'p'>>) => <p {...rest}>{children}</p>;
  return { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };
});

import { WorkflowVersionsDialog } from './WorkflowVersionsDialog';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('WorkflowVersionsDialog', () => {
  beforeEach(() => {
    mockUseWorkflowVersions.mockReset();
    mockUseRestoreWorkflowVersion.mockReset();
    mockMutateAsync.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    mockUseRestoreWorkflowVersion.mockImplementation(() => ({ mutateAsync: mockMutateAsync, isPending: false }));
  });

  it('affiche le chargement quand le dialogue est ouvert', async () => {
    mockUseWorkflowVersions.mockImplementation((id?: string) => {
      if (!id) return { data: undefined, isLoading: false, isError: false };
      return { data: undefined, isLoading: true, isError: false };
    });

    render(<WorkflowVersionsDialog workflow_id="wf1" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /versions/i }));

    expect(await screen.findByText('Chargement…')).toBeInTheDocument();
  });

  it('affiche les versions et permet de restaurer une version', async () => {
    mockUseWorkflowVersions.mockImplementation((id?: string) => {
      if (!id) return { data: undefined, isLoading: false, isError: false };
      return { data: VERSIONS, isLoading: false, isError: false };
    });
    mockMutateAsync.mockResolvedValue({});

    const onRestored = vi.fn();
    render(<WorkflowVersionsDialog workflow_id="wf1" onRestored={onRestored} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /versions/i }));

    expect(await screen.findByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('Première version')).toBeInTheDocument();
    expect(screen.getByText('Deuxième version')).toBeInTheDocument();

    expect(screen.getAllByText(/Déclencheur/)[0]).toBeInTheDocument();
    expect(screen.getByText('webhook')).toBeInTheDocument();
    expect(screen.getByText('manual')).toBeInTheDocument();

    const nodesLines = screen.getAllByText(/nœuds/);
    expect(nodesLines.length).toBeGreaterThanOrEqual(2);
    const edgesLines = screen.getAllByText(/liens/);
    expect(edgesLines.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText('init')).toBeInTheDocument();
    expect(screen.getByText('fix')).toBeInTheDocument();

    const restoreButtons = screen.getAllByRole('button', { name: /restaurer/i });
    expect(restoreButtons.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(restoreButtons[1]);

    const confirmBtn = await screen.findByRole('button', { name: /confirmer/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      expect(mockMutateAsync).toHaveBeenCalledWith(VERSIONS[1]);
    });

    await waitFor(() => {
      expect(onRestored).toHaveBeenCalledTimes(1);
    });
  });

  it('affiche un état vide si erreur (data null)', async () => {
    mockUseWorkflowVersions.mockImplementation((id?: string) => {
      if (!id) return { data: undefined, isLoading: false, isError: false };
      return { data: null, isLoading: false, isError: true };
    });

    render(<WorkflowVersionsDialog workflow_id="wf1" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /versions/i }));

    expect(await screen.findByText('Aucune version archivée pour le moment.')).toBeInTheDocument();
  });
});