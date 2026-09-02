import React from 'react';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentEditorToolbar } from './DocumentEditorToolbar';

// Stable hoisted mocks (must be hoisted to top-level)
const lucideMock = vi.hoisted(() => {
  const make = (name: string) => (props: any) => React.createElement('svg', { 'data-icon': name, ...props }, props?.children ?? null);
  return {
    Bold: make('Bold'),
    Italic: make('Italic'),
    Underline: make('Underline'),
    Strikethrough: make('Strikethrough'),
    Code: make('Code'),
    AlignLeft: make('AlignLeft'),
    AlignCenter: make('AlignCenter'),
    AlignRight: make('AlignRight'),
    AlignJustify: make('AlignJustify'),
    List: make('List'),
    ListOrdered: make('ListOrdered'),
    ListChecks: make('ListChecks'),
    Heading1: make('Heading1'),
    Heading2: make('Heading2'),
    Heading3: make('Heading3'),
    Table: make('Table'),
    Image: make('Image'),
    Link: make('Link'),
    Undo2: make('Undo2'),
    Redo2: make('Redo2'),
    Highlighter: make('Highlighter'),
    Minus: make('Minus'),
    Quote: make('Quote'),
    Palette: make('Palette'),
    FileDown: make('FileDown'),
    FileUp: make('FileUp'),
    Save: make('Save'),
    ChevronDown: make('ChevronDown'),
  };
});
vi.mock('lucide-react', () => lucideMock);

// Button component mock
const buttonMock = vi.hoisted(() => {
  const Button = (props: any) => {
    const { children, onClick, disabled, type, variant, size, className } = props;
    const ariaLabel = (props as any)['aria-label'] ?? (props as any).ariaLabel;
    const ariaPressed = (props as any)['aria-pressed'] ?? (props as any).ariaPressed;
    return (
      <button
        data-variant={variant}
        data-size={size}
        className={className}
        onClick={onClick}
        disabled={disabled}
        type={type}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
      >
        {children}
      </button>
    );
  };
  return { Button };
});
vi.mock('@/components/ui/button', () => buttonMock);

// Separator mock
const separatorMock = vi.hoisted(() => {
  const Separator = (props: any) => <div role="separator" {...props} />;
  return { Separator };
});
vi.mock('@/components/ui/separator', () => separatorMock);

// Tooltip mock
const tooltipMock = vi.hoisted(() => {
  const Tooltip = ({ children }: any) => <div>{children}</div>;
  const TooltipTrigger = ({ children }: any) => <div>{children}</div>;
  const TooltipContent = ({ children, ...rest }: any) => <div {...rest}>{children}</div>;
  const TooltipProvider = ({ children }: any) => <div>{children}</div>;
  return { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
});
vi.mock('@/components/ui/tooltip', () => tooltipMock);

// Dropdown menu mock
const dropdownMock = vi.hoisted(() => {
  const DropdownMenu = ({ children }: any) => <div>{children}</div>;
  const DropdownMenuTrigger = ({ children }: any) => <div>{children}</div>;
  const DropdownMenuContent = ({ children }: any) => <div>{children}</div>;
  const DropdownMenuSeparator = (_props: any) => <div data-testid="dd-sep" />;
  const DropdownMenuItem = ({ children, onClick, className }: any) => (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  );
  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  };
});
vi.mock('@/components/ui/dropdown-menu', () => dropdownMock);

// utils.cn mock
const utilsMock = vi.hoisted(() => {
  const cn = (...parts: any[]) => parts.filter(Boolean).join(' ');
  return { cn };
});
vi.mock('@/lib/utils', () => utilsMock);

// supabase client mock (chainable builder, thenable)
const supabaseMock = vi.hoisted(() => {
  const rows = [{ id: 'r1' }];
  const builder = {
    _args: {} as Record<string, any>,
    select() { return builder; },
    eq() { return builder; },
    gte() { return builder; },
    lte() { return builder; },
    'in'() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    insert() { return builder; },
    update() { return builder; },
    delete() { return builder; },
    single() { return Promise.resolve({ data: rows[0], error: null }); },
    maybeSingle() { return Promise.resolve({ data: rows[0], error: null }); },
    then(onFulfilled: any) { return Promise.resolve({ data: rows, error: null }).then(onFulfilled); },
    catch(onRejected: any) { return Promise.resolve({ data: rows, error: null }).catch(onRejected); },
  };
  const mockFrom = vi.fn(() => builder);
  return { supabase: { from: mockFrom } };
});
vi.mock('@/integrations/supabase/client', () => supabaseMock);

// react-router mock (useNavigate)
const routerMock = vi.hoisted(() => {
  const useNavigate = () => vi.fn();
  return { useNavigate };
});
vi.mock('react-router', () => routerMock);

// sonner toast mock
const sonnerMock = vi.hoisted(() => {
  const toast = { success: vi.fn(), error: vi.fn() };
  return { toast };
});
vi.mock('sonner', () => sonnerMock);

// Helper to create a controllable editor mock (not hoisted; fine)
function createEditorMock(options?: {
  canUndo?: boolean;
  canRedo?: boolean;
  activeFlags?: Record<string, boolean>;
  runReject?: boolean;
}) {
  const canUndo = options?.canUndo ?? true;
  const canRedo = options?.canRedo ?? true;
  const activeFlags = options?.activeFlags ?? {};
  const runMock = vi.fn(() => (options?.runReject ? Promise.reject(new Error('run-error')) : Promise.resolve()));
  const fns: Record<string, ReturnType<typeof vi.fn>> = {
    setImage: vi.fn(),
    setLink: vi.fn(),
    insertTable: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    toggleHeading: vi.fn(),
    toggleBold: vi.fn(),
    toggleItalic: vi.fn(),
    toggleUnderline: vi.fn(),
    toggleStrike: vi.fn(),
    toggleCode: vi.fn(),
    setColor: vi.fn(),
    unsetColor: vi.fn(),
    toggleHighlight: vi.fn(),
    unsetHighlight: vi.fn(),
    setTextAlign: vi.fn(),
    toggleBulletList: vi.fn(),
    toggleOrderedList: vi.fn(),
    toggleTaskList: vi.fn(),
    toggleBlockquote: vi.fn(),
    setHorizontalRule: vi.fn(),
  };

  const builder: any = { run: runMock };
  Object.keys(fns).forEach((k) => {
    builder[k] = (...args: any[]) => {
      fns[k](...args);
      return builder;
    };
  });

  const editor = {
    chain: () => ({
      focus: () => builder,
    }),
    can: () => ({
      undo: () => canUndo,
      redo: () => canRedo,
    }),
    isActive: (type: any, opts?: any) => {
      if (type === 'heading' && opts && typeof opts.level === 'number') {
        return activeFlags[`heading:${opts.level}`] ?? false;
      }
      if (typeof type === 'object' && type && 'textAlign' in type) {
        return activeFlags[`textAlign:${type.textAlign}`] ?? false;
      }
      return activeFlags[type as string] ?? false;
    },
    __mocks: { fns, runMock }, // expose for assertions
  };

  return editor;
}

describe('DocumentEditorToolbar', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  it('returns null when no editor is provided', () => {
    const { container } = render(<DocumentEditorToolbar editor={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders toolbar and responds to actions (save, export, import, insert image/link/table, text color)', async () => {
    const onSave = vi.fn();
    const onExportPdf = vi.fn();
    const onExportDocx = vi.fn();
    const onImportDocx = vi.fn();

    const editor = createEditorMock({
      canUndo: false,
      canRedo: true,
      activeFlags: {
        bold: true,
        link: true,
        'heading:1': true,
        'textAlign:left': true,
        bulletList: false,
      },
    });

    const originalPrompt = window.prompt;
    window.prompt = vi.fn().mockReturnValueOnce('https://example.com/image.png');

    render(
      <DocumentEditorToolbar
        editor={editor as any}
        onSave={onSave}
        onExportPdf={onExportPdf}
        onExportDocx={onExportDocx}
        onImportDocx={onImportDocx}
        isSaving={false}
      />
    );

    const saveButton = screen.getByLabelText('Enregistrer (Ctrl+S)');
    expect(saveButton).toBeInstanceOf(HTMLElement);
    await act(async () => {
      fireEvent.click(saveButton);
    });
    expect(onSave).toHaveBeenCalledTimes(1);

    const fileTrigger = screen.getByRole('button', { name: /Fichier/i });
    expect(fileTrigger).toBeTruthy();

    const importItem = screen.getByText('Importer DOCX');
    await act(async () => {
      fireEvent.click(importItem);
    });
    expect(onImportDocx).toHaveBeenCalledTimes(1);

    const exportPdfItem = screen.getByText('Exporter en PDF');
    const exportDocxItem = screen.getByText('Exporter en DOCX');
    await act(async () => {
      fireEvent.click(exportPdfItem);
      fireEvent.click(exportDocxItem);
    });
    expect(onExportPdf).toHaveBeenCalledTimes(1);
    expect(onExportDocx).toHaveBeenCalledTimes(1);

    const undoButton = screen.getByLabelText('Annuler');
    expect(undoButton).toBeInstanceOf(HTMLElement);
    expect(undoButton).toBeDisabled();

    const redoButton = screen.getByLabelText('Rétablir');
    expect(redoButton).toBeInstanceOf(HTMLElement);
    expect(redoButton).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(redoButton);
    });
    expect(editor.__mocks.fns.redo).toHaveBeenCalledTimes(1);

    const boldButton = screen.getByLabelText('Gras');
    expect(boldButton.getAttribute('aria-pressed')).toBe('true');

    const tableButton = screen.getByLabelText('Insérer un tableau');
    await act(async () => {
      fireEvent.click(tableButton);
    });
    expect(editor.__mocks.fns.insertTable).toHaveBeenCalledTimes(1);
    expect(editor.__mocks.fns.insertTable).toHaveBeenCalledWith({ rows: 3, cols: 3, withHeaderRow: true });

    const imageButton = screen.getByLabelText('Insérer une image');
    await act(async () => {
      fireEvent.click(imageButton);
      await Promise.resolve();
    });
    expect(window.prompt).toHaveBeenCalledWith("URL de l'image :");
    expect(editor.__mocks.fns.setImage).toHaveBeenCalledTimes(1);
    expect(editor.__mocks.fns.setImage).toHaveBeenCalledWith({ src: 'https://example.com/image.png' });

    (window.prompt as any).mockReturnValueOnce('https://example.com/');
    const linkButton = screen.getByLabelText('Insérer un lien');
    await act(async () => {
      fireEvent.click(linkButton);
      await Promise.resolve();
    });
    expect(window.prompt).toHaveBeenCalledWith('URL du lien :');
    expect(editor.__mocks.fns.setLink).toHaveBeenCalledTimes(1);
    expect(editor.__mocks.fns.setLink).toHaveBeenCalledWith({ href: 'https://example.com/' });

    const paletteButton = screen.getByLabelText('Palette');
    expect(paletteButton).toBeTruthy();
    const noirItem = screen.getByText('Noir');
    await act(async () => {
      fireEvent.click(noirItem);
    });
    expect(editor.__mocks.fns.setColor).toHaveBeenCalledTimes(1);
    expect(editor.__mocks.fns.setColor).toHaveBeenCalledWith('#000000');

    window.prompt = originalPrompt;
  });

  it('disables save button when isSaving is true', () => {
    const onSave = vi.fn();
    const editor = createEditorMock();
    render(
      <DocumentEditorToolbar
        editor={editor as any}
        onSave={onSave}
        isSaving={true}
      />
    );
    const saveButton = screen.getByLabelText('Enregistrer (Ctrl+S)');
    expect(saveButton).toBeDisabled();
  });

  it('uses a QueryClientProvider wrapper when testing hooks via renderHook', () => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const wrapper = ({ children }: any) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => 'ok', { wrapper });
    expect(result.current).toBe('ok');
  });

  it('handles builder.run rejection gracefully when image insertion run rejects', async () => {
    const editor = createEditorMock({ runReject: true });
    const originalPrompt = window.prompt;
    window.prompt = vi.fn().mockReturnValueOnce('https://example.com/bad.png');

    render(<DocumentEditorToolbar editor={editor as any} />);

    const imageButton = screen.getByLabelText('Insérer une image');
    await act(async () => {
      try {
        fireEvent.click(imageButton);
        await Promise.resolve();
      } catch (e) {
        // ignore
      }
    });

    expect(editor.__mocks.fns.setImage).toHaveBeenCalledTimes(1);
    expect(editor.__mocks.runMock).toHaveBeenCalledTimes(1);

    window.prompt = originalPrompt;
  });
});