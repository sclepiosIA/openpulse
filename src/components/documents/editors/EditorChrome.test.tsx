import { render, screen, fireEvent } from '@testing-library/react'
import { EditorHeader, SaveIndicator, EditorAIButton, EditorCloseButton } from './EditorChrome'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
  formatNumber: (value: number) => String(value),
}))

describe('EditorHeader', () => {
  it('affiche le nom du document, la marque et le kind', () => {
    render(<EditorHeader documentName="Mon rapport" kind="Document" />)
    expect(screen.getByText('Mon rapport')).toBeTruthy()
    expect(screen.getByText('OpenPulse')).toBeTruthy()
    expect(screen.getByText('Document · édition intelligente')).toBeTruthy()
  })

  it('affiche le kind Tableur et le slot enfants (actions)', () => {
    render(
      <EditorHeader documentName="Budget 2025" kind="Tableur">
        <button data-testid="action-btn">Exporter</button>
      </EditorHeader>
    )
    expect(screen.getByText('Tableur · édition intelligente')).toBeTruthy()
    expect(screen.getByTestId('action-btn').textContent).toBe('Exporter')
  })

  it('affiche l’indicateur de sauvegarde en cours quand isSaving=true', () => {
    render(<EditorHeader documentName="Doc" kind="Présentation" isSaving />)
    expect(screen.getByText('Enregistrement…')).toBeTruthy()
  })

  it('affiche l’heure de dernière sauvegarde quand lastSaved est fourni', () => {
    const lastSaved = new Date(2024, 0, 15, 14, 5)
    render(<EditorHeader documentName="Doc" kind="Document" lastSaved={lastSaved} />)
    expect(screen.getByText(/Enregistré à/)).toBeTruthy()
    expect(screen.getByText(/14:05/)).toBeTruthy()
  })
})

describe('SaveIndicator', () => {
  it('affiche "Enregistrement…" quand isSaving=true (même avec lastSaved)', () => {
    const lastSaved = new Date(2024, 0, 15, 9, 30)
    render(<SaveIndicator isSaving={true} lastSaved={lastSaved} />)
    expect(screen.getByText('Enregistrement…')).toBeTruthy()
    expect(screen.queryByText(/Enregistré à/)).toBeNull()
  })

  it('affiche l’heure formatée fr-FR quand isSaving=false et lastSaved défini', () => {
    const lastSaved = new Date(2024, 5, 1, 8, 7)
    render(<SaveIndicator isSaving={false} lastSaved={lastSaved} />)
    expect(screen.getByText(/Enregistré à/)).toBeTruthy()
    expect(screen.getByText(/08:07/)).toBeTruthy()
  })

  it('ne rend rien quand isSaving=false et lastSaved=null', () => {
    const { container } = render(<SaveIndicator isSaving={false} lastSaved={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('applique la className additionnelle', () => {
    render(<SaveIndicator isSaving={true} lastSaved={null} className="extra-class" />)
    const el = screen.getByText('Enregistrement…')
    expect(el.className).toContain('extra-class')
  })
})

describe('EditorAIButton', () => {
  it('rend le contenu, le title et appelle onClick au clic', () => {
    const onClick = vi.fn()
    render(
      <EditorAIButton onClick={onClick} title="Assistant IA">
        Améliorer
      </EditorAIButton>
    )
    const btn = screen.getByRole('button', { name: /Améliorer/ })
    expect(btn.getAttribute('title')).toBe('Assistant IA')
    expect(btn.getAttribute('type')).toBe('button')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('fusionne la className personnalisée avec les classes de base', () => {
    const onClick = vi.fn()
    render(
      <EditorAIButton onClick={onClick} className="ma-classe">
        IA
      </EditorAIButton>
    )
    const btn = screen.getByRole('button', { name: /IA/ })
    expect(btn.className).toContain('editor-ai-btn')
    expect(btn.className).toContain('ma-classe')
  })
})

describe('EditorCloseButton', () => {
  it('affiche "Fermer" et appelle onClose au clic', () => {
    const onClose = vi.fn()
    render(<EditorCloseButton onClose={onClose} />)
    const btn = screen.getByRole('button', { name: 'Fermer' })
    fireEvent.click(btn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
