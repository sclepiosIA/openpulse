import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ContractPreview } from './ContractPreview';

const { mockCn, sanitizeFn, openStub, printWindow } = vi.hoisted(() => {
  const mockCn = (...args: unknown[]) => args.filter(Boolean).join(' ');
  const sanitizeFn = vi.fn((html: string) =>
    String(html).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  );
  const printWindow = {
    document: {
      write: vi.fn(),
      close: vi.fn(),
    },
    print: vi.fn(),
  };
  const openStub = vi.fn(() => printWindow as unknown as Window);
  return { mockCn, sanitizeFn, openStub, printWindow };
});

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) =>
    React.createElement('button', { ...props }, props.children),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: (props: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { ...props }, props.children),
}));

vi.mock('lucide-react', () => ({
  Printer: (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { 'data-icon': 'printer', ...props }),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => mockCn(...args),
}));

vi.mock('dompurify', () => ({
  default: { sanitize: sanitizeFn },
}));

describe('ContractPreview', () => {
  beforeEach(() => {
    sanitizeFn.mockClear();
    printWindow.document.write.mockClear();
    printWindow.document.close.mockClear();
    printWindow.print.mockClear();
    openStub.mockReset();
    openStub.mockImplementation(() => printWindow as unknown as Window);
    vi.spyOn(window, 'open').mockImplementation(openStub as unknown as typeof window.open);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche l’état vide et l’en-tête', () => {
    render(<ContractPreview sections={[]} titre="Mon Contrat" />);

    expect(screen.getByText('Aperçu')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mon Contrat' })).toBeInTheDocument();
    expect(screen.getByText('Entre les parties ci-dessous désignées')).toBeInTheDocument();
    expect(screen.getByText('Aucune section dans ce contrat.')).toBeInTheDocument();
    expect(screen.getByText('Ajoutez des sections dans le panneau de gauche.')).toBeInTheDocument();
  });

  it('rende les sections avec numérotation, contenu et appelles sanitize', () => {
    const sections = [
      {
        id: 's1',
        titre: 'Introduction',
        contenu_html: '<p>Bienvenue</p>',
        children: [
          {
            id: 's1-1',
            titre: 'Objet',
            contenu_html: '<p>Objet content</p><script>alert(1)</script>',
          },
        ],
      },
      {
        id: 's2',
        titre: 'Durée',
        contenu_html: '<p>Démarre</p>',
      },
    ];

    const { container } = render(<ContractPreview sections={sections as any} titre="Contrat Test" />);

    const s1 = container.querySelector('#preview-section-s1') as HTMLElement;
    const s11 = container.querySelector('#preview-section-s1-1') as HTMLElement;
    const s2 = container.querySelector('#preview-section-s2') as HTMLElement;

    expect(s1).toBeInTheDocument();
    expect(s11).toBeInTheDocument();
    expect(s2).toBeInTheDocument();

    // Numérotation
    expect(within(s1).getByText('1.')).toBeInTheDocument();
    expect(within(s11).getByText('1.1.')).toBeInTheDocument();
    expect(within(s2).getByText('2.')).toBeInTheDocument();

    // Titres
    expect(within(s1).getByText('Introduction')).toBeInTheDocument();
    expect(within(s11).getByText('Objet')).toBeInTheDocument();
    expect(within(s2).getByText('Durée')).toBeInTheDocument();

    // Contenu
    expect(screen.getByText('Bienvenue')).toBeInTheDocument();
    expect(screen.getByText('Objet content')).toBeInTheDocument();
    expect(screen.getByText('Démarre')).toBeInTheDocument();

    // Sanitize appelé pour chaque contenu_html
    expect(sanitizeFn).toHaveBeenCalledTimes(3);
    expect(sanitizeFn).toHaveBeenCalledWith('<p>Bienvenue</p>');
    expect(sanitizeFn).toHaveBeenCalledWith('<p>Objet content</p><script>alert(1)</script>');
    expect(sanitizeFn).toHaveBeenCalledWith('<p>Démarre</p>');
  });

  it('applique le style de surlignage pour highlightedSectionId', () => {
    const sections = [
      {
        id: 's1',
        titre: 'Intro',
        contenu_html: '<p>Text</p>',
        children: [
          { id: 's1-1', titre: 'Child', contenu_html: '<p>Child</p>' },
        ],
      },
    ];

    const { container } = render(
      <ContractPreview sections={sections as any} titre="Contrat" highlightedSectionId="s1-1" />
    );

    const highlighted = container.querySelector('#preview-section-s1-1') as HTMLElement;
    expect(highlighted).toBeInTheDocument();
    expect(highlighted.className).toContain('bg-primary/5');
    expect(highlighted.className).toContain('border-l-2');
    expect(highlighted.className).toContain('border-primary');
    expect(highlighted.className).toContain('pl-3');
    expect(highlighted.className).toContain('-ml-3');
  });

  it('imprime le contenu avec un titre échappé et contenu sanitizé', () => {
    const sections = [
      {
        id: 's1',
        titre: 'Section',
        contenu_html: '<p>Texte</p><script>bad()</script>',
      },
    ];

    render(<ContractPreview sections={sections as any} titre={'Contrat <Test> & "Quote"'} />);

    const printBtn = screen.getByRole('button', { name: /imprimer/i });
    fireEvent.click(printBtn);

    expect(openStub).toHaveBeenCalledWith('', '_blank');
    expect(printWindow.document.write).toHaveBeenCalledTimes(1);

    const written = String(printWindow.document.write.mock.calls[0][0]);

    // Titre échappé dans <title> et <h1>
    expect(written).toContain('<title>Contrat &lt;Test&gt; &amp; &quot;Quote&quot;</title>');
    expect(written).toContain('<h1>Contrat &lt;Test&gt; &amp; &quot;Quote&quot;</h1>');

    // Contenu rendu (sanitizé, pas de balise script)
    expect(written).toContain('Texte');
    expect(written).not.toMatch(/<script/i);

    expect(printWindow.document.close).toHaveBeenCalled();
    expect(printWindow.print).toHaveBeenCalled();
  });

  it('ne fait rien si window.open retourne null', () => {
    openStub.mockImplementationOnce(() => null as unknown as Window);

    const sections = [
      {
        id: 's1',
        titre: 'S',
        contenu_html: '<p>C</p>',
      },
    ];

    render(<ContractPreview sections={sections as any} titre="T" />);

    const printBtn = screen.getByRole('button', { name: /imprimer/i });
    fireEvent.click(printBtn);

    expect(openStub).toHaveBeenCalled();
    expect(printWindow.document.write).not.toHaveBeenCalled();
    expect(printWindow.print).not.toHaveBeenCalled();
  });
});