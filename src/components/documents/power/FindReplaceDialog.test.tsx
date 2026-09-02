import { render, screen, fireEvent } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { FindReplaceDialog } from './FindReplaceDialog';

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('lucide-react', () => ({
  Search: () => null,
  ChevronUp: () => null,
  ChevronDown: () => null,
  Replace: () => null,
  ReplaceAll: () => null,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/input', async () => {
  const React = await import('react');
  return {
    Input: React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>((props, ref) => (
      <input {...props} ref={ref} />
    )),
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant,
    size,
    ...props
  }: {
    children?: React.ReactNode;
    variant?: string;
    size?: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    ...props
  }: { children?: React.ReactNode } & React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
  }) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked ?? false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

type DescNode = { isText: boolean; isBlock: boolean; text?: string };

function makeEditor(textContent: string) {
  const chainApi = {
    focus: vi.fn(() => chainApi),
    setTextSelection: vi.fn(() => chainApi),
    insertContent: vi.fn(() => chainApi),
    run: vi.fn(),
  };
  const commands = {
    setTextSelection: vi.fn(),
    scrollIntoView: vi.fn(),
  };
  const editorObj = {
    state: {
      doc: {
        content: { size: textContent.length + 2 },
        textBetween: vi.fn(() => textContent),
        descendants: (cb: (node: DescNode, pos: number) => boolean | void) => {
          cb({ isText: true, isBlock: false, text: textContent }, 1);
        },
      },
    },
    commands,
    chain: vi.fn(() => chainApi),
  };
  return { editor: editorObj as unknown as Editor, chainApi, commands };
}

describe('FindReplaceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ne rend rien quand open=false', () => {
    const { editor } = makeEditor('hello world');
    render(
      <FindReplaceDialog open={false} onOpenChange={vi.fn()} editor={editor} />,
    );
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('affiche le titre, "Aucun résultat" et des boutons désactivés sans requête', () => {
    render(<FindReplaceDialog open onOpenChange={vi.fn()} editor={null} />);
    expect(screen.getByText('Rechercher & remplacer')).toBeTruthy();
    expect(screen.getByText('Aucun résultat')).toBeTruthy();
    const replaceBtn = screen.getByRole('button', { name: /^Remplacer$/ }) as HTMLButtonElement;
    const allBtn = screen.getByRole('button', { name: /^Tout$/ }) as HTMLButtonElement;
    expect(replaceBtn.disabled).toBe(true);
    expect(allBtn.disabled).toBe(true);
  });

  it('trouve les occurrences insensibles à la casse et sélectionne la première', () => {
    const { editor, commands } = makeEditor('hello world hello');
    render(<FindReplaceDialog open onOpenChange={vi.fn()} editor={editor} />);
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'HELLO' } });
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(commands.setTextSelection).toHaveBeenCalledWith({ from: 1, to: 6 });
    expect(commands.scrollIntoView).toHaveBeenCalled();
  });

  it('respecte la sensibilité à la casse quand le switch Casse est activé', () => {
    const { editor } = makeEditor('hello world hello');
    render(<FindReplaceDialog open onOpenChange={vi.fn()} editor={editor} />);
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'HELLO' } });
    expect(screen.getByText('1 / 2')).toBeTruthy();
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]); // Casse
    expect(screen.getByText('Aucun résultat')).toBeTruthy();
  });

  it('navigue avec Entrée (suivant), boucle, et Maj+Entrée (précédent)', () => {
    const { editor } = makeEditor('hello world hello');
    render(<FindReplaceDialog open onOpenChange={vi.fn()} editor={editor} />);
    const findInput = screen.getByLabelText('Rechercher');
    fireEvent.change(findInput, { target: { value: 'hello' } });
    expect(screen.getByText('1 / 2')).toBeTruthy();
    fireEvent.keyDown(findInput, { key: 'Enter' });
    expect(screen.getByText('2 / 2')).toBeTruthy();
    fireEvent.keyDown(findInput, { key: 'Enter' });
    expect(screen.getByText('1 / 2')).toBeTruthy();
    fireEvent.keyDown(findInput, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });

  it('ferme le dialogue avec Échap', () => {
    const onOpenChange = vi.fn();
    const { editor } = makeEditor('hello');
    render(<FindReplaceDialog open onOpenChange={onOpenChange} editor={editor} />);
    fireEvent.keyDown(screen.getByLabelText('Rechercher'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('remplace une occurrence via le chain de l’éditeur et notifie', () => {
    const { editor, chainApi } = makeEditor('hello world hello');
    render(<FindReplaceDialog open onOpenChange={vi.fn()} editor={editor} />);
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'hello' } });
    fireEvent.change(screen.getByLabelText('Remplacer par'), { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: /^Remplacer$/ }));
    expect(chainApi.setTextSelection).toHaveBeenCalledWith({ from: 1, to: 6 });
    expect(chainApi.insertContent).toHaveBeenCalledWith('hi');
    expect(chainApi.run).toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith('Occurrence remplacée');
  });

  it('remplace toutes les occurrences de la fin vers le début', () => {
    const { editor, chainApi } = makeEditor('hello world hello');
    render(<FindReplaceDialog open onOpenChange={vi.fn()} editor={editor} />);
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'hello' } });
    fireEvent.change(screen.getByLabelText('Remplacer par'), { target: { value: 'salut' } });
    fireEvent.click(screen.getByRole('button', { name: /^Tout$/ }));
    expect(chainApi.setTextSelection).toHaveBeenNthCalledWith(1, { from: 13, to: 18 });
    expect(chainApi.setTextSelection).toHaveBeenNthCalledWith(2, { from: 1, to: 6 });
    expect(chainApi.insertContent).toHaveBeenCalledTimes(2);
    expect(chainApi.insertContent).toHaveBeenCalledWith('salut');
    expect(toastMock.success).toHaveBeenCalledWith('2 occurrence(s) remplacée(s)');
  });

  it('supporte le mode regex et ignore les motifs invalides', () => {
    const { editor } = makeEditor('abc a1c a2c');
    render(<FindReplaceDialog open onOpenChange={vi.fn()} editor={editor} />);
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[2]); // Regex
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'a\\dc' } });
    expect(screen.getByText('1 / 2')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: '[' } });
    expect(screen.getByText('Aucun résultat')).toBeTruthy();
  });
});