/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JarvisImageUpload } from './JarvisImageUpload';

const {
  mockToast,
  mockUseToast,
  mockInvokeEdge,
  mockSanitizeSupabaseError,
  mockCn,
} = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockUseToast: vi.fn(),
  mockInvokeEdge: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  mockCn: vi.fn((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: mockUseToast,
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    ImagePlus: Icon,
    X: Icon,
    Loader2: Icon,
    FileText: Icon,
    Eye: Icon,
    Database: Icon,
    Upload: Icon,
  };
});

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
    }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

  readAsDataURL(file: File) {
    const encoded = file.name === 'paste.png' ? 'cGFzdGUtYmFzZTY0' : 'dGVzdC1iYXNlNjQ=';
    this.result = `data:${file.type};base64,${encoded}`;
    if (this.onload) {
      this.onload({
        target: { result: this.result },
      } as unknown as ProgressEvent<FileReader>);
    }
  }
}

describe('JarvisImageUpload', () => {
  beforeAll(() => {
    vi.stubGlobal('FileReader', MockFileReader);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockSanitizeSupabaseError.mockReturnValue('sanitized error');
  });

  it('affiche la zone de drop initiale puis traite un fichier image, permet de choisir une tâche et lance une analyse avec les bonnes valeurs', async () => {
    mockInvokeEdge.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              content: 'Texte détecté',
            });
          }, 0);
        })
    );

    const onAnalysisComplete = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <JarvisImageUpload onAnalysisComplete={onAnalysisComplete} onCancel={onCancel} className="custom-class" />
    );

    expect(screen.getByText('Glissez une image ou cliquez')).toBeInTheDocument();
    expect(screen.getByText('ou collez avec Ctrl+V • Max 10 Mo')).toBeInTheDocument();

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    const file = new File(['img'], 'facture.png', { type: 'image/png' });
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(await screen.findByAltText('Preview')).toBeInTheDocument();
    expect(screen.getByText('facture.png')).toBeInTheDocument();
    expect(screen.getByText('Description détaillée')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /extraire texte/i }));
    expect(screen.getByText('OCR du document')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: /analyser/i }).at(-1) as HTMLButtonElement);

    expect(screen.getByText('Analyse en cours...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith('jarvis-vision', {
        image_base64: 'dGVzdC1iYXNlNjQ=',
        task: 'ocr',
      });
    });

    await waitFor(() => {
      expect(onAnalysisComplete).toHaveBeenCalledWith({
        content: 'Texte détecté',
        task: 'ocr',
      });
    });

    await waitFor(() => {
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    });

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('gère le drag and drop invalide puis valide et permet de supprimer l’image', async () => {
    const onAnalysisComplete = vi.fn();
    const { container } = render(<JarvisImageUpload onAnalysisComplete={onAnalysisComplete} />);

    const dropZone = container.querySelector('[tabindex="0"] > div');
    expect(dropZone).not.toBeNull();

    fireEvent.dragOver(dropZone as HTMLElement, {
      preventDefault: vi.fn(),
    });
    expect(screen.getByText("Déposez l'image ici")).toBeInTheDocument();

    const textFile = new File(['txt'], 'note.txt', { type: 'text/plain' });
    fireEvent.drop(dropZone as HTMLElement, {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [textFile],
      },
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Format non supporté',
      description: 'Veuillez utiliser une image (JPEG, PNG, etc.)',
      variant: 'destructive',
    });

    const imageFile = new File(['img'], 'photo.png', { type: 'image/png' });
    fireEvent.drop(dropZone as HTMLElement, {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [imageFile],
      },
    });

    expect(await screen.findByAltText('Preview')).toBeInTheDocument();
    expect(screen.getByText('photo.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    await waitFor(() => {
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Glissez une image ou cliquez')).toBeInTheDocument();
  });

  it('refuse un fichier de plus de 10 Mo', () => {
    const onAnalysisComplete = vi.fn();
    const { container } = render(<JarvisImageUpload onAnalysisComplete={onAnalysisComplete} />);

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    const bigFile = new File(['x'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [bigFile] },
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Fichier trop volumineux',
      description: 'La taille maximum est de 10 Mo',
      variant: 'destructive',
    });

    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
  });

  it('supporte le collage d’image depuis le presse-papiers', async () => {
    const onAnalysisComplete = vi.fn();
    const { container } = render(<JarvisImageUpload onAnalysisComplete={onAnalysisComplete} />);

    const root = container.querySelector('[tabindex="0"]');
    expect(root).not.toBeNull();

    const pastedFile = new File(['img'], 'paste.png', { type: 'image/png' });
    fireEvent.paste(root as HTMLElement, {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => pastedFile,
          },
        ],
      },
    });

    expect(await screen.findByAltText('Preview')).toBeInTheDocument();
    expect(screen.getByText('paste.png')).toBeInTheDocument();
  });

  it("affiche une erreur d'analyse si la fonction edge renvoie success=false", async () => {
    mockInvokeEdge.mockResolvedValue({
      success: false,
      error: 'edge failed',
    });
    mockSanitizeSupabaseError.mockReturnValue('message nettoyé');

    const onAnalysisComplete = vi.fn();
    const { container } = render(<JarvisImageUpload onAnalysisComplete={onAnalysisComplete} />);

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    const file = new File(['img'], 'err.png', { type: 'image/png' });
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(await screen.findByAltText('Preview')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /analyser/i }).at(-1) as HTMLButtonElement);

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith('jarvis-vision', {
        image_base64: 'dGVzdC1iYXNlNjQ=',
        task: 'analyze',
      });
    });

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Erreur d'analyse",
      description: 'message nettoyé',
      variant: 'destructive',
    });

    expect(onAnalysisComplete).not.toHaveBeenCalled();
    expect(screen.getByAltText('Preview')).toBeInTheDocument();
  });
});