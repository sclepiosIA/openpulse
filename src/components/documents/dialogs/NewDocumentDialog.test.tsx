// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewDocumentDialog } from './NewDocumentDialog';

const {
  mockDialog,
  mockDialogContent,
  mockDialogHeader,
  mockDialogTitle,
  mockDialogDescription,
  mockButton,
  mockInput,
  mockLabel,
  mockHelpMeCreateDialog,
} = vi.hoisted(() => ({
  mockDialog: vi.fn(
    ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? <div data-testid="dialog">{children}</div> : null
  ),
  mockDialogContent: vi.fn(({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  )),
  mockDialogHeader: vi.fn(({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>),
  mockDialogTitle: vi.fn(({ children }: { children: React.ReactNode }) => <h1>{children}</h1>),
  mockDialogDescription: vi.fn(({ children }: { children: React.ReactNode }) => <p>{children}</p>),
  mockButton: vi.fn(
    ({
      children,
      onClick,
      disabled,
      variant,
      className,
    }: {
      children: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
      disabled?: boolean;
      variant?: string;
      className?: string;
    }) => (
      <button type="button" data-variant={variant} className={className} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    )
  ),
  mockInput: vi.fn(
    ({
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
    }) => (
      <input id={id} placeholder={placeholder} value={value} onChange={onChange} onKeyDown={onKeyDown} />
    )
  ),
  mockLabel: vi.fn(({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  )),
  mockHelpMeCreateDialog: vi.fn(
    ({
      open,
      onDocumentCreated,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      onDocumentCreated?: (html: string, title: string) => void;
    }) => (
      <div
        data-testid="help-me-create-dialog"
        data-open={open ? 'true' : 'false'}
        data-has-callback={onDocumentCreated ? 'true' : 'false'}
      />
    )
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: mockDialog,
  DialogContent: mockDialogContent,
  DialogHeader: mockDialogHeader,
  DialogTitle: mockDialogTitle,
  DialogDescription: mockDialogDescription,
}));

vi.mock('@/components/ui/button', () => ({
  Button: mockButton,
}));

vi.mock('@/components/ui/input', () => ({
  Input: mockInput,
}));

vi.mock('@/components/ui/label', () => ({
  Label: mockLabel,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/documents/ai/HelpMeCreateDialog', () => ({
  HelpMeCreateDialog: mockHelpMeCreateDialog,
}));

vi.mock('lucide-react', () => ({
  FileText: ({ className }: { className?: string }) => <svg data-testid="icon-filetext" className={className} />,
  Table2: ({ className }: { className?: string }) => <svg data-testid="icon-table2" className={className} />,
  Presentation: ({ className }: { className?: string }) => <svg data-testid="icon-presentation" className={className} />,
  FileUp: ({ className }: { className?: string }) => <svg data-testid="icon-fileup" className={className} />,
  Loader2: ({ className }: { className?: string }) => <svg data-testid="icon-loader2" className={className} />,
  Sparkles: ({ className }: { className?: string }) => <svg data-testid="icon-sparkles" className={className} />,
}));

describe('NewDocumentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le contenu principal et les options de création', () => {
    const onOpenChange = vi.fn();
    const onCreateDocument = vi.fn();
    const onImportFile = vi.fn();
    const onAIDocumentCreated = vi.fn();

    render(
      <NewDocumentDialog
        open={true}
        onOpenChange={onOpenChange}
        onCreateDocument={onCreateDocument}
        onImportFile={onImportFile}
        onAIDocumentCreated={onAIDocumentCreated}
      />
    );

    expect(screen.getByText('Nouveau document')).toBeInTheDocument();
    expect(screen.getByText('Choisissez le type de document à créer')).toBeInTheDocument();
    expect(screen.getByText('Help me create')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Document/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tableur/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Présentation/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Nom du document')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importer un fichier/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer' })).toBeInTheDocument();

    const helpDialog = screen.getByTestId('help-me-create-dialog');
    expect(helpDialog).toHaveAttribute('data-open', 'false');
    expect(helpDialog).toHaveAttribute('data-has-callback', 'true');
  });

  it('utilise le nom saisi et le type sélectionné lors de la création', () => {
    const onOpenChange = vi.fn();
    const onCreateDocument = vi.fn();
    const dateSpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('15/01/2026');

    render(<NewDocumentDialog open={true} onOpenChange={onOpenChange} onCreateDocument={onCreateDocument} />);

    fireEvent.click(screen.getByRole('button', { name: /Tableur/i }));

    const input = screen.getByLabelText('Nom du document');
    fireEvent.change(input, { target: { value: 'Budget 2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

    expect(onCreateDocument).toHaveBeenCalledTimes(1);
    expect(onCreateDocument).toHaveBeenCalledWith('Budget 2026', 'native_sheet');
    expect(screen.getByLabelText('Nom du document')).toHaveValue('');
    expect(screen.getByLabelText('Nom du document')).toHaveAttribute('placeholder', 'Tableur 15/01/2026');

    dateSpy.mockRestore();
  });

  it('génère un nom par défaut selon le type si le champ est vide', () => {
    const onOpenChange = vi.fn();
    const onCreateDocument = vi.fn();
    const dateSpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('15/01/2026');

    render(<NewDocumentDialog open={true} onOpenChange={onOpenChange} onCreateDocument={onCreateDocument} />);

    fireEvent.click(screen.getByRole('button', { name: /Présentation/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

    expect(onCreateDocument).toHaveBeenCalledTimes(1);
    expect(onCreateDocument).toHaveBeenCalledWith('Présentation 15/01/2026', 'native_pres');
    expect(screen.getByLabelText('Nom du document')).toHaveAttribute('placeholder', 'Présentation 15/01/2026');

    dateSpy.mockRestore();
  });

  it('crée aussi avec la touche Entrée dans le champ nom', () => {
    const onOpenChange = vi.fn();
    const onCreateDocument = vi.fn();

    render(<NewDocumentDialog open={true} onOpenChange={onOpenChange} onCreateDocument={onCreateDocument} />);

    const input = screen.getByLabelText('Nom du document');
    fireEvent.change(input, { target: { value: 'Compte rendu' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(onCreateDocument).toHaveBeenCalledTimes(1);
    expect(onCreateDocument).toHaveBeenCalledWith('Compte rendu', 'native_doc');
  });

  it('ferme le dialogue au clic sur Annuler', () => {
    const onOpenChange = vi.fn();
    const onCreateDocument = vi.fn();

    render(<NewDocumentDialog open={true} onOpenChange={onOpenChange} onCreateDocument={onCreateDocument} />);

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('déclenche l’import si le bouton est présent', () => {
    const onOpenChange = vi.fn();
    const onCreateDocument = vi.fn();
    const onImportFile = vi.fn();

    render(
      <NewDocumentDialog
        open={true}
        onOpenChange={onOpenChange}
        onCreateDocument={onCreateDocument}
        onImportFile={onImportFile}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Importer un fichier/i }));

    expect(onImportFile).toHaveBeenCalledTimes(1);
  });

  it('ouvre le flux IA et ferme le dialogue courant', () => {
    const onOpenChange = vi.fn();
    const onCreateDocument = vi.fn();

    render(<NewDocumentDialog open={true} onOpenChange={onOpenChange} onCreateDocument={onCreateDocument} />);

    fireEvent.click(screen.getByRole('button', { name: /Help me create/i }));

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    const helpDialog = screen.getByTestId('help-me-create-dialog');
    expect(helpDialog).toHaveAttribute('data-open', 'true');
  });

  it('désactive la création et affiche le loader quand isCreating=true', () => {
    const onOpenChange = vi.fn();
    const onCreateDocument = vi.fn();

    render(
      <NewDocumentDialog
        open={true}
        onOpenChange={onOpenChange}
        onCreateDocument={onCreateDocument}
        isCreating={true}
      />
    );

    const createButton = screen.getByRole('button', { name: /Créer/i });
    expect(createButton).toBeDisabled();
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();

    fireEvent.click(createButton);
    expect(onCreateDocument).not.toHaveBeenCalled();
  });

  it('n’affiche pas le Dialog quand open=false mais garde le composant IA fermé', () => {
    const onOpenChange = vi.fn();
    const onCreateDocument = vi.fn();

    render(<NewDocumentDialog open={false} onOpenChange={onOpenChange} onCreateDocument={onCreateDocument} />);

    expect(screen.queryByText('Nouveau document')).not.toBeInTheDocument();

    const helpDialog = screen.getByTestId('help-me-create-dialog');
    expect(helpDialog).toHaveAttribute('data-open', 'false');
  });
});