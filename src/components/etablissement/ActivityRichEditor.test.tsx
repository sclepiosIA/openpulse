// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ActivityRichEditor } from './ActivityRichEditor';

const {
  editorState,
  improveMock,
  reformulateMock,
  shortenMock,
  pulseState,
  useEditorMock,
  starterConfigureMock,
  placeholderConfigureMock,
  taskItemConfigureMock,
} = vi.hoisted(() => {
  const state = {
    html: '<p>Texte initial</p>',
    text: 'Texte initial',
    isActiveMap: {
      bold: false,
      italic: true,
      underline: false,
      bulletList: false,
      orderedList: false,
      taskList: false,
    } as Record<string, boolean>,
    editorAvailable: true,
    latestOptions: null as
      | {
          content: string;
          onUpdate: ({ editor }: { editor: { getHTML: () => string } }) => void;
          extensions?: unknown[];
        }
      | null,
    setContent: vi.fn((value: string) => {
      state.html = value;
      state.text = value.replace(/<[^>]+>/g, '').trim();
    }),
    chainCalls: [] as string[],
  };

  return {
    editorState: state,
    improveMock: vi.fn(),
    reformulateMock: vi.fn(),
    shortenMock: vi.fn(),
    pulseState: {
      isProcessing: false,
    },
    useEditorMock: vi.fn(),
    starterConfigureMock: vi.fn(() => ({ name: 'starter-kit' })),
    placeholderConfigureMock: vi.fn(({ placeholder }: { placeholder: string }) => ({
      name: 'placeholder',
      placeholder,
    })),
    taskItemConfigureMock: vi.fn(() => ({ name: 'task-item' })),
  };
});

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: starterConfigureMock,
  },
}));

vi.mock('@tiptap/extension-underline', () => ({
  default: { name: 'underline' },
}));

vi.mock('@tiptap/extension-placeholder', () => ({
  default: {
    configure: placeholderConfigureMock,
  },
}));

vi.mock('@tiptap/extension-task-list', () => ({
  default: { name: 'task-list' },
}));

vi.mock('@tiptap/extension-task-item', () => ({
  default: {
    configure: taskItemConfigureMock,
  },
}));

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn((options: {
    content: string;
    onUpdate: ({ editor }: { editor: { getHTML: () => string } }) => void;
    extensions?: unknown[];
  }) => {
    useEditorMock(options);
    editorState.latestOptions = options;

    if (!editorState.editorAvailable) {
      return null;
    }

    const chain = {
      focus: vi.fn(() => chain),
      toggleBold: vi.fn(() => {
        editorState.chainCalls.push('toggleBold');
        return chain;
      }),
      toggleItalic: vi.fn(() => {
        editorState.chainCalls.push('toggleItalic');
        return chain;
      }),
      toggleUnderline: vi.fn(() => {
        editorState.chainCalls.push('toggleUnderline');
        return chain;
      }),
      toggleBulletList: vi.fn(() => {
        editorState.chainCalls.push('toggleBulletList');
        return chain;
      }),
      toggleOrderedList: vi.fn(() => {
        editorState.chainCalls.push('toggleOrderedList');
        return chain;
      }),
      toggleTaskList: vi.fn(() => {
        editorState.chainCalls.push('toggleTaskList');
        return chain;
      }),
      run: vi.fn(() => true),
    };

    return {
      getHTML: vi.fn(() => editorState.html),
      getText: vi.fn(() => editorState.text),
      isActive: vi.fn((name: string) => Boolean(editorState.isActiveMap[name])),
      chain: vi.fn(() => chain),
      commands: {
        setContent: editorState.setContent,
      },
    };
  }),
  EditorContent: ({ editor }: { editor: { getHTML: () => string } }) => (
    <div data-testid="editor-content">{editor.getHTML()}</div>
  ),
}));

vi.mock('@/hooks/pulse/usePulseAIEditor', () => ({
  usePulseAIEditor: vi.fn(() => ({
    isProcessing: pulseState.isProcessing,
    improve: improveMock,
    reformulate: reformulateMock,
    shorten: shortenMock,
  })),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    className,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button type={type ?? 'button'} className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: ({ orientation, className }: { orientation?: string; className?: string }) => (
    <div data-testid="separator" data-orientation={orientation} className={className} />
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode; side?: string; className?: string }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  DropdownMenuContent: ({
    children,
    align,
  }: {
    children: React.ReactNode;
    align?: string;
  }) => <div data-align={align}>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Bold: Icon,
    Italic: Icon,
    Underline: Icon,
    List: Icon,
    ListOrdered: Icon,
    CheckSquare: Icon,
    Sparkles: Icon,
    Loader2: Icon,
    Wand2: Icon,
    AlignLeft: Icon,
    Minimize2: Icon,
  };
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('ActivityRichEditor', () => {
  beforeEach(() => {
    editorState.html = '<p>Texte initial</p>';
    editorState.text = 'Texte initial';
    editorState.isActiveMap = {
      bold: false,
      italic: true,
      underline: false,
      bulletList: false,
      orderedList: false,
      taskList: false,
    };
    editorState.editorAvailable = true;
    editorState.latestOptions = null;
    editorState.chainCalls = [];
    editorState.setContent.mockClear();

    pulseState.isProcessing = false;

    improveMock.mockReset();
    reformulateMock.mockReset();
    shortenMock.mockReset();
    useEditorMock.mockClear();
    starterConfigureMock.mockClear();
    placeholderConfigureMock.mockClear();
    taskItemConfigureMock.mockClear();
  });

  it('gère un hook react-query complet : loading puis succès puis erreur', async () => {
    const wrapper = createWrapper();

    const successFn = vi.fn().mockResolvedValue('ok');
    const errorFn = vi.fn().mockRejectedValue(new Error('x'));

    const { result, rerender } = renderHook(
      ({ shouldFail }: { shouldFail: boolean }) =>
        useQuery({
          queryKey: ['activity-rich-editor-hook-test', shouldFail ? 'error' : 'success'],
          queryFn: shouldFail ? errorFn : successFn,
        }),
      {
        initialProps: { shouldFail: false },
        wrapper,
      }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe('ok');
    expect(successFn).toHaveBeenCalledTimes(1);

    rerender({ shouldFail: true });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
  });

  it('rend null quand l’éditeur n’est pas disponible', () => {
    editorState.editorAvailable = false;
    const onChange = vi.fn();

    const { container } = render(
      <ActivityRichEditor content="<p>Vide</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    expect(container.firstChild).toBeNull();
  });

  it('affiche la toolbar, le contenu métier et configure les extensions avec le placeholder', () => {
    const onChange = vi.fn();

    render(
      <ActivityRichEditor
        content="<p>Texte initial</p>"
        onChange={onChange}
        placeholder="Écrire les points clés"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('IA')).toBeInTheDocument();
    expect(screen.getByText('Gras')).toBeInTheDocument();
    expect(screen.getByText('Italique')).toBeInTheDocument();
    expect(screen.getByText('Souligné')).toBeInTheDocument();
    expect(screen.getByText('Liste')).toBeInTheDocument();
    expect(screen.getByText('Liste numérotée')).toBeInTheDocument();
    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.getByText('Structurer les notes')).toBeInTheDocument();
    expect(screen.getByText('Améliorer le texte')).toBeInTheDocument();
    expect(screen.getByText('Reformuler')).toBeInTheDocument();
    expect(screen.getByText('Raccourcir')).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toHaveTextContent('<p>Texte initial</p>');

    expect(starterConfigureMock).toHaveBeenCalledWith({
      bulletList: { keepMarks: true, keepAttributes: false },
      orderedList: { keepMarks: true, keepAttributes: false },
    });
    expect(taskItemConfigureMock).toHaveBeenCalledWith({ nested: true });
    expect(placeholderConfigureMock).toHaveBeenCalledWith({ placeholder: 'Écrire les points clés' });

    const italicButton = screen.getByText('Italique').closest('div')?.querySelector('button');
    const boldButton = screen.getByText('Gras').closest('div')?.querySelector('button');

    expect(italicButton).not.toBeNull();
    expect(boldButton).not.toBeNull();
    expect(italicButton?.className).toContain('bg-muted');
    expect(boldButton?.className).not.toContain('bg-muted');
  });

  it('déclenche les commandes de formatage de la toolbar', () => {
    const onChange = vi.fn();

    render(
      <ActivityRichEditor content="<p>Texte initial</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    const grasButton = screen.getByText('Gras').closest('div')?.querySelector('button');
    const listeButton = screen.getByText('Liste').closest('div')?.querySelector('button');
    const checklistButton = screen.getByText('Checklist').closest('div')?.querySelector('button');

    expect(grasButton).not.toBeNull();
    expect(listeButton).not.toBeNull();
    expect(checklistButton).not.toBeNull();

    fireEvent.click(grasButton as HTMLButtonElement);
    fireEvent.click(listeButton as HTMLButtonElement);
    fireEvent.click(checklistButton as HTMLButtonElement);

    expect(editorState.chainCalls).toEqual(['toggleBold', 'toggleBulletList', 'toggleTaskList']);
  });

  it('synchronise le contenu externe dans l’éditeur sans emitUpdate false lors du changement de prop', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <ActivityRichEditor content="<p>Texte initial</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    expect(editorState.setContent).not.toHaveBeenCalled();

    rerender(<ActivityRichEditor content="<p>Nouveau contenu</p>" onChange={onChange} />);

    expect(editorState.setContent).toHaveBeenCalledWith('<p>Nouveau contenu</p>', { emitUpdate: false });
  });

  it('appelle onChange avec le HTML réel lors de la mise à jour de l’éditeur', async () => {
    const onChange = vi.fn();

    render(
      <ActivityRichEditor content="<p>Texte initial</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    editorState.html = '<p>Contenu modifié</p>';

    await act(async () => {
      editorState.latestOptions?.onUpdate({
        editor: {
          getHTML: () => '<p>Contenu modifié</p>',
        },
      });
    });

    expect(onChange).toHaveBeenCalledWith('<p>Contenu modifié</p>');
  });

  it('utilise improve pour structurer les notes et applique le résultat', async () => {
    const onChange = vi.fn();
    improveMock.mockResolvedValue('Texte structuré');
    editorState.text = 'Notes brutes';

    render(
      <ActivityRichEditor content="<p>Texte initial</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Structurer les notes'));
    });

    await waitFor(() => {
      expect(improveMock).toHaveBeenCalledWith('Notes brutes');
    });

    expect(editorState.setContent).toHaveBeenCalledWith('Texte structuré');
    expect(onChange).toHaveBeenCalledWith('Texte structuré');
  });

  it('utilise improve pour améliorer le texte et applique le résultat', async () => {
    const onChange = vi.fn();
    improveMock.mockResolvedValue('Texte amélioré');
    editorState.text = 'Du texte';

    render(
      <ActivityRichEditor content="<p>Texte initial</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Améliorer le texte'));
    });

    await waitFor(() => {
      expect(improveMock).toHaveBeenCalledWith('Du texte');
    });

    expect(editorState.setContent).toHaveBeenCalledWith('Texte amélioré');
    expect(onChange).toHaveBeenCalledWith('Texte amélioré');
  });

  it('utilise reformulate pour reformuler le texte', async () => {
    const onChange = vi.fn();
    reformulateMock.mockResolvedValue('Texte reformulé');
    editorState.text = 'Texte à reformuler';

    render(
      <ActivityRichEditor content="<p>Texte initial</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Reformuler'));
    });

    await waitFor(() => {
      expect(reformulateMock).toHaveBeenCalledWith('Texte à reformuler');
    });

    expect(editorState.setContent).toHaveBeenCalledWith('Texte reformulé');
    expect(onChange).toHaveBeenCalledWith('Texte reformulé');
  });

  it('utilise shorten pour raccourcir le texte', async () => {
    const onChange = vi.fn();
    shortenMock.mockResolvedValue('Texte court');
    editorState.text = 'Texte beaucoup trop long';

    render(
      <ActivityRichEditor content="<p>Texte initial</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Raccourcir'));
    });

    await waitFor(() => {
      expect(shortenMock).toHaveBeenCalledWith('Texte beaucoup trop long');
    });

    expect(editorState.setContent).toHaveBeenCalledWith('Texte court');
    expect(onChange).toHaveBeenCalledWith('Texte court');
  });

  it('ne lance aucune action IA si le texte est vide', async () => {
    const onChange = vi.fn();
    editorState.text = '   ';

    render(
      <ActivityRichEditor content="<p>Texte initial</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Améliorer le texte'));
    });

    expect(improveMock).not.toHaveBeenCalled();
    expect(reformulateMock).not.toHaveBeenCalled();
    expect(shortenMock).not.toHaveBeenCalled();
    expect(editorState.setContent).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('n’applique pas de contenu si l’IA renvoie null', async () => {
    const onChange = vi.fn();
    improveMock.mockResolvedValue(null);
    editorState.text = 'Du texte';

    render(
      <ActivityRichEditor content="<p>Texte initial</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Améliorer le texte'));
    });

    await waitFor(() => {
      expect(improveMock).toHaveBeenCalledWith('Du texte');
    });

    expect(editorState.setContent).not.toHaveBeenCalledWith(null);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('désactive le bouton IA pendant le traitement', () => {
    pulseState.isProcessing = true;
    const onChange = vi.fn();

    render(
      <ActivityRichEditor content="<p>Texte initial</p>" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByRole('button', { name: /ia/i })).toBeDisabled();
  });
});