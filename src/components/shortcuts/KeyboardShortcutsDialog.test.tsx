import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog'

vi.mock('@/components/ui/dialog', async () => {
  const React = await import('react')

  type DialogProps = {
    children?: import('react').ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }

  type BaseProps = {
    children?: import('react').ReactNode
    className?: string
  }

  const Dialog = ({ children, open }: DialogProps) =>
    open ? React.createElement('div', { 'data-testid': 'dialog-root' }, children) : null

  const DialogContent = ({ children, className }: BaseProps) =>
    React.createElement('section', { role: 'dialog', 'data-testid': 'dialog-content', className }, children)

  const DialogHeader = ({ children, className }: BaseProps) =>
    React.createElement('header', { className }, children)

  const DialogTitle = ({ children, className }: BaseProps) =>
    React.createElement('h2', { className }, children)

  const DialogDescription = ({ children, className }: BaseProps) =>
    React.createElement('p', { className }, children)

  return {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
  }
})

vi.mock('lucide-react', async () => {
  const React = await import('react')

  type KeyboardProps = {
    className?: string
  }

  const Keyboard = (props: KeyboardProps) =>
    React.createElement('svg', { ...props, 'data-testid': 'keyboard-icon', 'aria-hidden': 'true' })

  return { Keyboard }
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('KeyboardShortcutsDialog', () => {
  it('ne rend pas la boîte de dialogue au chargement initial', () => {
    render(<KeyboardShortcutsDialog />)

    expect(screen.queryByText('Raccourcis clavier')).toBeNull()
    expect(screen.queryByText('Navigation')).toBeNull()
    expect(screen.queryByText('Ouvrir la recherche globale')).toBeNull()
  })

  it('ouvre le panneau avec ? et affiche les catégories et raccourcis métier', () => {
    render(<KeyboardShortcutsDialog />)

    fireEvent.keyDown(window, { key: '?' })

    expect(screen.getByTestId('dialog-root')).toBeTruthy()
    expect(screen.getByTestId('dialog-content')).toBeTruthy()
    expect(screen.getByTestId('keyboard-icon')).toBeTruthy()
    expect(screen.getByText('Raccourcis clavier')).toBeTruthy()

    expect(screen.getByText('Navigation')).toBeTruthy()
    expect(screen.getByText('Tableaux')).toBeTruthy()
    expect(screen.getByText('Sélection')).toBeTruthy()
    expect(screen.getByText('Email')).toBeTruthy()

    expect(screen.getByText('Ouvrir la recherche globale')).toBeTruthy()
    expect(screen.getByText('Ouvrir la recherche globale (Windows/Linux)')).toBeTruthy()
    expect(screen.getByText('Afficher les raccourcis clavier')).toBeTruthy()
    expect(screen.getByText('Fermer les boîtes de dialogue')).toBeTruthy()
    expect(screen.getByText('Valider une édition inline')).toBeTruthy()
    expect(screen.getByText('Annuler une édition inline')).toBeTruthy()
    expect(screen.getByText('Cellule suivante')).toBeTruthy()
    expect(screen.getByText('Naviguer dans les résultats')).toBeTruthy()
    expect(screen.getByText('Sélectionner / désélectionner une ligne')).toBeTruthy()
    expect(screen.getByText('Tout sélectionner')).toBeTruthy()
    expect(screen.getByText('Répondre')).toBeTruthy()
    expect(screen.getByText('Répondre à tous')).toBeTruthy()
    expect(screen.getByText('Transférer')).toBeTruthy()
    expect(screen.getByText('Archiver / marquer traité')).toBeTruthy()

    expect(screen.getAllByText('?')).toHaveLength(2)
    expect(screen.getAllByText('Esc')).toHaveLength(2)
    expect(screen.getAllByText('R')).toHaveLength(2)
    expect(screen.getAllByText('Maj')).toHaveLength(1)
    expect(screen.getAllByText('⌘')).toHaveLength(2)
    expect(screen.getAllByText('K')).toHaveLength(2)
    expect(screen.getAllByText('Ctrl')).toHaveLength(1)
    expect(screen.getAllByText('↑')).toHaveLength(1)
    expect(screen.getAllByText('↓')).toHaveLength(1)
  })

  it('referme le panneau quand ? est pressé une seconde fois', () => {
    render(<KeyboardShortcutsDialog />)

    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByText('Raccourcis clavier')).toBeTruthy()
    expect(screen.getByText('Tout sélectionner')).toBeTruthy()

    fireEvent.keyDown(window, { key: '?' })

    expect(screen.queryByText('Raccourcis clavier')).toBeNull()
    expect(screen.queryByText('Tout sélectionner')).toBeNull()
  })

  it('ignore ? depuis les champs texte, selects et zones éditables', () => {
    render(<KeyboardShortcutsDialog />)

    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')

    Object.defineProperty(editable, 'isContentEditable', {
      value: true,
      configurable: true,
    })

    document.body.append(input, textarea, select, editable)

    fireEvent.keyDown(input, { key: '?' })
    fireEvent.keyDown(textarea, { key: '?' })
    fireEvent.keyDown(select, { key: '?' })
    fireEvent.keyDown(editable, { key: '?' })

    expect(screen.queryByText('Raccourcis clavier')).toBeNull()
    expect(screen.queryByText('Navigation')).toBeNull()

    fireEvent.keyDown(window, { key: '?' })

    expect(screen.getByText('Raccourcis clavier')).toBeTruthy()
    expect(screen.getByText('Navigation')).toBeTruthy()
  })

  it('ignore les autres touches clavier', () => {
    render(<KeyboardShortcutsDialog />)

    fireEvent.keyDown(window, { key: 'k' })
    fireEvent.keyDown(window, { key: '/' })
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByText('Raccourcis clavier')).toBeNull()
    expect(screen.queryByText('Email')).toBeNull()
  })
})