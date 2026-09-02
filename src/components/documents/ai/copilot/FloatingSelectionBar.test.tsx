import { render, fireEvent } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { FloatingSelectionBar } from './FloatingSelectionBar'

const { ACTIONS, GROUP_LABELS, LANGUAGES } = vi.hoisted(() => {
  const IconStub = () => null
  const ACTIONS = [
    {
      id: 'improve',
      label: 'Améliorer',
      description: 'Améliore la clarté du texte',
      group: 'rewrite',
      needsSelection: true,
      surfaces: ['document'],
      icon: IconStub,
    },
    {
      id: 'hidden-no-selection',
      label: 'Action sans sélection',
      description: 'Ne doit pas apparaître',
      group: 'rewrite',
      needsSelection: false,
      surfaces: ['document'],
      icon: IconStub,
    },
    {
      id: 'translate',
      label: 'Traduire',
      description: 'Traduit la sélection',
      group: 'transform',
      needsSelection: true,
      surfaces: ['document'],
      icon: IconStub,
    },
    {
      id: 'resume',
      label: 'Résumer',
      description: 'Résume la sélection',
      group: 'transform',
      needsSelection: true,
      surfaces: ['document'],
      icon: IconStub,
    },
  ]
  const GROUP_LABELS = {
    rewrite: 'Réécriture',
    transform: 'Transformation',
  }
  const LANGUAGES = [
    { code: 'en', label: 'Anglais' },
    { code: 'es', label: 'Espagnol' },
  ]
  return { ACTIONS, GROUP_LABELS, LANGUAGES }
})

vi.mock('./actions', () => ({
  COPILOT_ACTIONS: ACTIONS,
  COPILOT_GROUP_LABEL: GROUP_LABELS,
  TRANSLATE_LANGUAGES: LANGUAGES,
}))

vi.mock('@tiptap/react', () => ({
  BubbleMenu: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="bubble-menu">{children}</div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled }: { children?: React.ReactNode; disabled?: boolean }) => (
    <button disabled={disabled}>{children}</button>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const Item = ({ children, onSelect }: { children?: React.ReactNode; onSelect?: () => void }) => (
    <div role="menuitem" onClick={onSelect}>
      {children}
    </div>
  )
  return {
    DropdownMenu: Passthrough,
    DropdownMenuTrigger: Passthrough,
    DropdownMenuContent: Passthrough,
    DropdownMenuGroup: Passthrough,
    DropdownMenuItem: Item,
    DropdownMenuLabel: Passthrough,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuSub: Passthrough,
    DropdownMenuSubContent: Passthrough,
    DropdownMenuSubTrigger: Passthrough,
  }
})

const fakeEditor = { isEditable: true } as unknown as Editor

describe('FloatingSelectionBar', () => {
  it('ne rend rien quand editor est null', () => {
    const onRunAction = vi.fn()
    const { container } = render(
      <FloatingSelectionBar editor={null} isRunning={false} onRunAction={onRunAction} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('affiche le bouton IA Copilot, les labels de groupes et les actions filtrées', () => {
    const onRunAction = vi.fn()
    const { getByText, queryByText, getAllByRole } = render(
      <FloatingSelectionBar editor={fakeEditor} isRunning={false} onRunAction={onRunAction} />
    )

    expect(getByText('IA Copilot')).toBeTruthy()
    expect(getByText('Réécriture')).toBeTruthy()
    expect(getByText('Transformation')).toBeTruthy()
    expect(getByText('Améliorer')).toBeTruthy()
    expect(getByText('Résumer')).toBeTruthy()
    expect(getByText('Améliore la clarté du texte')).toBeTruthy()

    // action sans sélection exclue
    expect(queryByText('Action sans sélection')).toBeNull()
    // translate exclu de la liste directe (uniquement via sous-menu)
    expect(queryByText('Traduire')).toBeNull()
    expect(getByText('Traduire vers…')).toBeTruthy()

    // 3 actions directes (improve, resume) + 2 langues = 4 menuitems
    expect(getAllByRole('menuitem')).toHaveLength(4)
  })

  it("appelle onRunAction avec l'action sélectionnée au clic", () => {
    const onRunAction = vi.fn()
    const { getByText } = render(
      <FloatingSelectionBar editor={fakeEditor} isRunning={false} onRunAction={onRunAction} />
    )

    fireEvent.click(getByText('Améliorer'))
    expect(onRunAction).toHaveBeenCalledTimes(1)
    expect(onRunAction).toHaveBeenCalledWith(ACTIONS[0])
  })

  it("appelle onRunAction avec l'action translate et la langue choisie", () => {
    const onRunAction = vi.fn()
    const { getByText } = render(
      <FloatingSelectionBar editor={fakeEditor} isRunning={false} onRunAction={onRunAction} />
    )

    fireEvent.click(getByText('Anglais'))
    expect(onRunAction).toHaveBeenCalledTimes(1)
    expect(onRunAction).toHaveBeenCalledWith(
      ACTIONS.find((a) => a.id === 'translate'),
      { language: 'en' }
    )

    fireEvent.click(getByText('Espagnol'))
    expect(onRunAction).toHaveBeenLastCalledWith(
      ACTIONS.find((a) => a.id === 'translate'),
      { language: 'es' }
    )
  })

  it('désactive le bouton déclencheur quand isRunning est true', () => {
    const onRunAction = vi.fn()
    const { getByText } = render(
      <FloatingSelectionBar editor={fakeEditor} isRunning={true} onRunAction={onRunAction} />
    )

    const trigger = getByText('IA Copilot').closest('button')
    expect(trigger).not.toBeNull()
    expect(trigger).toHaveProperty('disabled', true)
  })

  it('le bouton déclencheur est actif quand isRunning est false', () => {
    const onRunAction = vi.fn()
    const { getByText } = render(
      <FloatingSelectionBar editor={fakeEditor} isRunning={false} onRunAction={onRunAction} />
    )

    const trigger = getByText('IA Copilot').closest('button')
    expect(trigger).not.toBeNull()
    expect(trigger).toHaveProperty('disabled', false)
  })
})
