// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RichTextEditor } from './RichTextEditor';

const {
  chainApi,
  canApi,
  editorInstance,
  mockUseEditor,
  mockUpload,
  mockGetPublicUrl,
  mockStorageFrom,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
} = vi.hoisted(() => {
  const chainApi = {
    focus: vi.fn(() => chainApi),
    toggleBold: vi.fn(() => chainApi),
    toggleItalic: vi.fn(() => chainApi),
    toggleUnderline: vi.fn(() => chainApi),
    toggleHeading: vi.fn(() => chainApi),
    toggleBulletList: vi.fn(() => chainApi),
    toggleOrderedList: vi.fn(() => chainApi),
    toggleBlockquote: vi.fn(() => chainApi),
    toggleCodeBlock: vi.fn(() => chainApi),
    setLink: vi.fn(() => chainApi),
    setImage: vi.fn(() => chainApi),
    undo: vi.fn(() => chainApi),
    redo: vi.fn(() => chainApi),
    run: vi.fn(() => true),
  };

  const canApi = {
    undo: vi.fn(() => true),
    redo: vi.fn(() => true),
  };

  const editorInstance = {
    chain: vi.fn(() => chainApi),
    can: vi.fn(() => canApi),
    isActive: vi.fn(() => false),
    getHTML: vi.fn(() => '<p>initial</p>'),
    commands: {
      setContent: vi.fn(),
    },
  };

  const mockUseEditor = vi.fn(() => editorInstance);
  const mockUpload = vi.fn(async () => ({ error: null }));
  const mockGetPublicUrl = vi.fn(() => ({
    data: { publicUrl: 'https://cdn.test/img.png' },
  }));
  const mockStorageFrom = vi.fn(() => ({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
  }));

  return {
    chainApi,
    canApi,
    editorInstance,
    mockUseEditor,
    mockUpload,
    mockGetPublicUrl,
    mockStorageFrom,
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockDebugError: vi.fn(),
  };
});

vi.mock('@tiptap/react', () => ({
  useEditor: mockUseEditor,
  EditorContent: ({ className }: { className?: string; editor?: unknown }) => (
    <div data-testid="editor-content" className={className}>
      editor-content
    </div>
  ),
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: vi.fn(() => ({ name: 'starter-kit' })),
  },
}));

vi.mock('@tiptap/extension-link', () => ({
  default: {
    extend: vi.fn(() => ({
      configure: vi.fn(() => ({ name: 'link-email' })),
    })),
  },
}));

vi.mock('@tiptap/extension-image', () => ({
  default: {
    configure: vi.fn(() => ({ name: 'image' })),
  },
}));

vi.mock('@tiptap/extension-placeholder', () => ({
  default: {
    configure: vi.fn(() => ({ name: 'placeholder' })),
  },
}));

vi.mock('@tiptap/extension-underline', () => ({
  default: {
    extend: vi.fn(() => ({
      configure: vi.fn(() => ({ name: 'underline-email' })),
    })),
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    title,
    type,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    title?: string;
    type?: 'button' | 'submit' | 'reset';
    className?: string;
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} title={title} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (value: boolean) => void;
    children: React.ReactNode;
  }) => <div data-testid={open ? 'dialog-open' : 'dialog-closed'}>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    id,
    placeholder,
    value,
    onChange,
    onKeyDown,
  }: {
    id?: string;
    placeholder?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  }) => <input id={id} placeholder={placeholder} value={value} onChange={onChange} onKeyDown={onKeyDown} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: mockStorageFrom,
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Bold: Icon,
    Italic: Icon,
    Underline: Icon,
    List: Icon,
    ListOrdered: Icon,
    Link: Icon,
    Image: Icon,
    Upload: Icon,
    Undo: Icon,
    Redo: Icon,
    Quote: Icon,
    Heading2: Icon,
    Code: Icon,
    Sparkles: Icon,
  };
});

describe('RichTextEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEditor.mockReturnValue(editorInstance);
    editorInstance.getHTML.mockReturnValue('<p>initial</p>');
    editorInstance.isActive.mockReturnValue(false);
    canApi.undo.mockReturnValue(true);
    canApi.redo.mockReturnValue(true);
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/img.png' } });
  });

  it('rend la barre d’outils, le contenu éditeur et l’overlay IA', () => {
    const onChange = vi.fn();

    const { container } = render(
      <RichTextEditor content="<p>bonjour</p>" onChange={onChange} isProcessing isAnimating />
    );

    expect(screen.getByTitle('Gras (Ctrl+B)')).toBeInTheDocument();
    expect(screen.getByTitle('Italique (Ctrl+I)')).toBeInTheDocument();
    expect(screen.getByTitle('Insérer un lien')).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    expect(screen.getByText("L'IA travaille...")).toBeInTheDocument();
    expect(container.querySelector('.ai-text-transition')).not.toBeNull();
  });

  it('met à jour le contenu de l’éditeur quand la prop content change', () => {
    const onChange = vi.fn();
    editorInstance.getHTML.mockReturnValue('<p>different</p>');

    const { rerender } = render(<RichTextEditor content="<p>one</p>" onChange={onChange} />);

    expect(editorInstance.commands.setContent).toHaveBeenCalledWith('<p>one</p>');

    rerender(<RichTextEditor content="<p>two</p>" onChange={onChange} />);

    expect(editorInstance.commands.setContent).toHaveBeenCalledWith('<p>two</p>');
  });

  it('ouvre le dialogue de lien et insère un lien avec l’URL saisie', async () => {
    const onChange = vi.fn();

    render(<RichTextEditor content="<p>txt</p>" onChange={onChange} />);

    fireEvent.click(screen.getByTitle('Insérer un lien'));
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://site.test' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Insérer' })[0]);

    await waitFor(() => {
      expect(chainApi.focus).toHaveBeenCalled();
      expect(chainApi.setLink).toHaveBeenCalledWith({ href: 'https://site.test' });
      expect(chainApi.run).toHaveBeenCalled();
    });
  });

  it('ouvre le dialogue image et insère une image avec alt personnalisé', async () => {
    const onChange = vi.fn();

    render(<RichTextEditor content="<p>txt</p>" onChange={onChange} />);

    fireEvent.click(screen.getByTitle("Insérer une image via URL"));
    fireEvent.change(screen.getByLabelText("URL de l'image"), {
      target: { value: 'https://img.test/pic.jpg' },
    });
    fireEvent.change(screen.getByLabelText('Texte alternatif'), {
      target: { value: 'Une image' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Insérer' })[1]);

    await waitFor(() => {
      expect(chainApi.setImage).toHaveBeenCalledWith({
        src: 'https://img.test/pic.jpg',
        alt: 'Une image',
      });
      expect(chainApi.run).toHaveBeenCalled();
    });
  });

  it('refuse un fichier non image et affiche un toast d’erreur', () => {
    const onChange = vi.fn();

    const { container } = render(<RichTextEditor content="<p>txt</p>" onChange={onChange} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['abc'], 'doc.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockToastError).toHaveBeenCalledWith('Veuillez sélectionner une image');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('refuse une image de plus de 3 Mo et affiche un toast d’erreur', () => {
    const onChange = vi.fn();

    const { container } = render(<RichTextEditor content="<p>txt</p>" onChange={onChange} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File(['a'], 'big.png', { type: 'image/png' });
    Object.defineProperty(bigFile, 'size', { value: 4 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    expect(mockToastError).toHaveBeenCalledWith("L'image est trop volumineuse (max 3 Mo)");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('téléverse une image valide, insère son URL publique et affiche un toast de succès', async () => {
    const onChange = vi.fn();

    const { container } = render(<RichTextEditor content="<p>txt</p>" onChange={onChange} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const imageFile = new File(['img'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(imageFile, 'size', { value: 1024 });

    fireEvent.change(fileInput, { target: { files: [imageFile] } });

    await waitFor(() => {
      expect(mockStorageFrom).toHaveBeenCalledWith('editor-images');
      expect(mockUpload).toHaveBeenCalledTimes(1);
    });

    const uploadCall = mockUpload.mock.calls[0];
    expect(uploadCall[0]).toContain('comments/');
    expect(uploadCall[0]).toContain('-photo.png');
    expect(uploadCall[1]).toBe(imageFile);
    expect(uploadCall[2]).toEqual({
      upsert: false,
      contentType: 'image/png',
    });

    await waitFor(() => {
      expect(mockGetPublicUrl).toHaveBeenCalled();
      expect(chainApi.setImage).toHaveBeenCalledWith({
        src: 'https://cdn.test/img.png',
        alt: 'photo.png',
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Image téléversée avec succès');
    });

    expect(fileInput.value).toBe('');
  });

  it('gère une erreur de téléversement et journalise l’erreur', async () => {
    const onChange = vi.fn();
    mockUpload.mockResolvedValue({ error: { message: 'upload failed' } });

    const { container } = render(<RichTextEditor content="<p>txt</p>" onChange={onChange} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const imageFile = new File(['img'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(imageFile, 'size', { value: 1024 });

    fireEvent.change(fileInput, { target: { files: [imageFile] } });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Échec du téléversement de l'image");
      expect(mockDebugError).toHaveBeenCalledWith("Erreur d'upload:", { message: 'upload failed' });
    });

    expect(chainApi.setImage).not.toHaveBeenCalled();
    expect(fileInput.value).toBe('');
  });

  it('désactive les boutons quand disabled est vrai', () => {
    const onChange = vi.fn();

    render(<RichTextEditor content="<p>txt</p>" onChange={onChange} disabled />);

    expect(screen.getByTitle('Gras (Ctrl+B)')).toBeDisabled();
    expect(screen.getByTitle('Italique (Ctrl+I)')).toBeDisabled();
    expect(screen.getByTitle('Insérer un lien')).toBeDisabled();
    expect(screen.getByTitle("Insérer une image via URL")).toBeDisabled();
  });

  it('désactive annuler/rétablir selon les capacités de l’éditeur', () => {
    const onChange = vi.fn();
    canApi.undo.mockReturnValue(false);
    canApi.redo.mockReturnValue(false);

    render(<RichTextEditor content="<p>txt</p>" onChange={onChange} />);

    expect(screen.getByTitle('Annuler (Ctrl+Z)')).toBeDisabled();
    expect(screen.getByTitle('Rétablir (Ctrl+Y)')).toBeDisabled();
  });
});