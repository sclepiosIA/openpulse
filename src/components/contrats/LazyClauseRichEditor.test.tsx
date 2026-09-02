import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { Component, type ComponentProps, type ReactElement, type ReactNode } from 'react';

const { innerRenderMock, editorMockState } = vi.hoisted(() => ({
  innerRenderMock: vi.fn((props: Record<string, unknown>) => props),
  editorMockState: {
    shouldThrow: false,
    successText: 'Éditeur mocké',
    errorMessage: 'Échec du chargement',
  },
}));

vi.mock('./ClauseRichEditor', () => ({
  ClauseRichEditor: (props: Record<string, unknown>) => {
    if (editorMockState.shouldThrow) {
      throw new Error(editorMockState.errorMessage);
    }

    innerRenderMock(props);
    return editorMockState.successText;
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: ReactElement) {
  return render(
    <QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>
  );
}

async function importFreshLazyClauseRichEditor() {
  vi.resetModules();
  const mod = await import('./LazyClauseRichEditor');
  return mod.ClauseRichEditor;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      message: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }

  render() {
    if (this.state.message !== null) {
      return <div role="alert">{this.state.message}</div>;
    }

    return this.props.children;
  }
}

describe('LazyClauseRichEditor', () => {
  it("affiche le fallback de chargement de l'éditeur avant la résolution du composant lazy", async () => {
    editorMockState.shouldThrow = false;
    innerRenderMock.mockClear();

    const ClauseRichEditor = await importFreshLazyClauseRichEditor();
    const props = {} as ComponentProps<typeof ClauseRichEditor>;

    renderWithClient(<ClauseRichEditor {...props} />);

    const fallback = screen.getByText("Chargement de l'éditeur…");
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveClass(
      'min-h-[120px]',
      'flex',
      'items-center',
      'justify-center',
      'text-xs',
      'text-muted-foreground',
      'border',
      'rounded-md'
    );

    expect(await screen.findByText(editorMockState.successText)).toBeInTheDocument();
  });

  it('rend le composant riche chargé et lui transmet les props métier', async () => {
    editorMockState.shouldThrow = false;
    innerRenderMock.mockClear();

    const ClauseRichEditor = await importFreshLazyClauseRichEditor();
    const onChange = vi.fn((value: string) => value);
    const props = {
      value: 'Clause de paiement',
      disabled: true,
      onChange,
    } as unknown as ComponentProps<typeof ClauseRichEditor>;

    renderWithClient(<ClauseRichEditor {...props} />);

    expect(await screen.findByText(editorMockState.successText)).toBeInTheDocument();

    await waitFor(() => {
      expect(innerRenderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'Clause de paiement',
          disabled: true,
          onChange,
        })
      );
    });
  });

  it("remonte l'erreur du composant lazy à une ErrorBoundary", async () => {
    editorMockState.shouldThrow = true;
    innerRenderMock.mockClear();

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const ClauseRichEditor = await importFreshLazyClauseRichEditor();
      const props = {} as ComponentProps<typeof ClauseRichEditor>;

      renderWithClient(
        <ErrorBoundary>
          <ClauseRichEditor {...props} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Chargement de l'éditeur…")).toBeInTheDocument();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        editorMockState.errorMessage
      );
      expect(innerRenderMock).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
      editorMockState.shouldThrow = false;
    }
  });
});