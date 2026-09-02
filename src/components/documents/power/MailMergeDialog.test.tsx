import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MailMergeDialog } from './MailMergeDialog';
import type { Editor } from '@tiptap/react';

const { mockExportToPdf, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockExportToPdf: vi.fn(() => Promise.resolve()),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/lib/documentExport', () => ({
  exportToPdf: mockExportToPdf,
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea data-testid="csv-textarea" {...props} />
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid="file-input" {...props} />
  ),
}));

function makeEditor(html: string): Editor {
  return { getHTML: () => html } as unknown as Editor;
}

const CSV = 'nom,email\nJean,j@ex.com\nMarie,m@ex.com';

describe('MailMergeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExportToPdf.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('ne rend rien quand open=false', () => {
    render(
      <MailMergeDialog
        open={false}
        onOpenChange={vi.fn()}
        editor={makeEditor('<p>{{nom}}</p>')}
        documentName="Doc"
      />
    );
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('affiche le titre et les placeholders détectés dans le document', () => {
    render(
      <MailMergeDialog
        open={true}
        onOpenChange={vi.fn()}
        editor={makeEditor('<p>Bonjour {{nom}}, email: {{email}}</p>')}
        documentName="Doc"
      />
    );
    expect(screen.getByText('Publipostage')).toBeTruthy();
    expect(screen.getByText('{{nom}}')).toBeTruthy();
    expect(screen.getByText('{{email}}')).toBeTruthy();
  });

  it('affiche un message quand aucun placeholder n\'est détecté', () => {
    render(
      <MailMergeDialog
        open={true}
        onOpenChange={vi.fn()}
        editor={makeEditor('<p>Sans variable</p>')}
        documentName="Doc"
      />
    );
    expect(screen.getByText(/aucun/)).toBeTruthy();
  });

  it('détecte colonnes et lignes après collage du CSV', () => {
    render(
      <MailMergeDialog
        open={true}
        onOpenChange={vi.fn()}
        editor={makeEditor('<p>{{nom}}</p>')}
        documentName="Doc"
      />
    );
    fireEvent.change(screen.getByTestId('csv-textarea'), { target: { value: CSV } });
    expect(screen.getByText('nom, email')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Générer 2 PDF')).toBeTruthy();
  });

  it('désactive le bouton Générer sans lignes CSV', () => {
    render(
      <MailMergeDialog
        open={true}
        onOpenChange={vi.fn()}
        editor={makeEditor('<p>{{nom}}</p>')}
        documentName="Doc"
      />
    );
    const btn = screen.getByText('Générer 0 PDF') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('génère un PDF par ligne avec le template fusionné et nommage par index', async () => {
    const onOpenChange = vi.fn();
    render(
      <MailMergeDialog
        open={true}
        onOpenChange={onOpenChange}
        editor={makeEditor('<p>Bonjour {{nom}}</p>')}
        documentName="Doc"
      />
    );
    fireEvent.change(screen.getByTestId('csv-textarea'), { target: { value: CSV } });
    await act(async () => {
      fireEvent.click(screen.getByText('Générer 2 PDF'));
    });
    expect(mockExportToPdf).toHaveBeenCalledTimes(2);
    expect(mockExportToPdf).toHaveBeenNthCalledWith(1, '<p>Bonjour Jean</p>', 'Doc-1');
    expect(mockExportToPdf).toHaveBeenNthCalledWith(2, '<p>Bonjour Marie</p>', 'Doc-2');
    expect(mockToastSuccess).toHaveBeenCalledWith('2 document(s) générés');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('nomme les fichiers selon la colonne sélectionnée', async () => {
    render(
      <MailMergeDialog
        open={true}
        onOpenChange={vi.fn()}
        editor={makeEditor('<p>{{nom}}</p>')}
        documentName="Lettre"
      />
    );
    fireEvent.change(screen.getByTestId('csv-textarea'), { target: { value: CSV } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'nom' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Générer 2 PDF'));
    });
    expect(mockExportToPdf).toHaveBeenNthCalledWith(1, '<p>Jean</p>', 'Lettre-Jean');
    expect(mockExportToPdf).toHaveBeenNthCalledWith(2, '<p>Marie</p>', 'Lettre-Marie');
  });

  it('échappe les caractères HTML dans les valeurs fusionnées', async () => {
    render(
      <MailMergeDialog
        open={true}
        onOpenChange={vi.fn()}
        editor={makeEditor('<p>{{nom}}</p>')}
        documentName="Doc"
      />
    );
    fireEvent.change(screen.getByTestId('csv-textarea'), {
      target: { value: 'nom\n"<b>Jean & Cie</b>"' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Générer 1 PDF'));
    });
    expect(mockExportToPdf).toHaveBeenCalledWith(
      '<p>&lt;b&gt;Jean &amp; Cie&lt;/b&gt;</p>',
      'Doc-1'
    );
  });

  it('affiche un toast d\'erreur si exportToPdf échoue', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockExportToPdf.mockRejectedValueOnce(new Error('boom'));
    const onOpenChange = vi.fn();
    render(
      <MailMergeDialog
        open={true}
        onOpenChange={onOpenChange}
        editor={makeEditor('<p>{{nom}}</p>')}
        documentName="Doc"
      />
    );
    fireEvent.change(screen.getByTestId('csv-textarea'), { target: { value: CSV } });
    await act(async () => {
      fireEvent.click(screen.getByText('Générer 2 PDF'));
    });
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors du publipostage');
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('appelle onOpenChange(false) au clic sur Annuler', () => {
    const onOpenChange = vi.fn();
    render(
      <MailMergeDialog
        open={true}
        onOpenChange={onOpenChange}
        editor={makeEditor('<p>{{nom}}</p>')}
        documentName="Doc"
      />
    );
    fireEvent.click(screen.getByText('Annuler'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});