import React, { createContext, useContext, type InputHTMLAttributes, type ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const { RESULTS, EMPTY, mockSearchModules, mockNavigate } = vi.hoisted(() => {
  const RESULTS = [
    { id: 'm1', title: 'Introduction', description: 'Les bases du tutoriel' },
    { id: 'm2', title: 'Approfondissement', description: 'Aller plus loin' },
  ]
  const EMPTY: Array<{ id: string; title: string; description: string }> = []
  const mockSearchModules = vi.fn((q: string) => {
    if (q === 're') return RESULTS
    if (q === 'zz') return EMPTY
    return []
  })
  const mockNavigate = vi.fn()
  return { RESULTS, EMPTY, mockSearchModules, mockNavigate }
})

vi.mock('@/lib/tutoriel-content', () => ({
  searchModules: mockSearchModules,
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('lucide-react', () => ({
  Search: () => null,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/popover', () => {
  const Popover = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  const PopoverTrigger = ({ children }: { asChild?: boolean; children?: ReactNode }) => <div>{children}</div>
  const PopoverContent = ({ children }: { className?: string; align?: string; children?: ReactNode }) => (
    <div>{children}</div>
  )
  return { Popover, PopoverTrigger, PopoverContent }
})

vi.mock('@/components/ui/command', () => {
  const Ctx = createContext<{ hasItems: boolean }>({ hasItems: false })

  const hasCommandItem = (node: ReactNode): boolean => {
    let found = false
    const iterate = (n: ReactNode) => {
      if (found) return
      React.Children.forEach(n as ReactNode, (child) => {
        if (found) return
        if (React.isValidElement(child)) {
          if (child.props && child.props['data-command-item']) {
            found = true
            return
          }
          if (child.props && child.props.children) {
            iterate(child.props.children)
          }
        }
      })
    }
    iterate(node)
    return found
  }

  const Command = ({ children }: { children?: ReactNode }) => {
    const hasItems = hasCommandItem(children)
    return <Ctx.Provider value={{ hasItems }}>{children}</Ctx.Provider>
  }
  const CommandList = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  const CommandGroup = ({ children }: { heading?: string; children?: ReactNode }) => <div>{children}</div>
  const CommandItem = ({
    onSelect,
    children,
    className,
    value,
  }: {
    onSelect?: (value?: string) => void
    className?: string
    value?: string
    children?: ReactNode
  }) => (
    <button
      type="button"
      data-command-item
      className={className}
      onClick={() => onSelect?.(value)}
    >
      {children}
    </button>
  )
  const CommandEmpty = ({ children }: { children?: ReactNode }) => {
    const { hasItems } = useContext(Ctx)
    return hasItems ? null : <div>{children}</div>
  }
  return { Command, CommandList, CommandGroup, CommandItem, CommandEmpty }
})

import { TutorielSearch } from './TutorielSearch'

describe('TutorielSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("n'affiche rien pour une requête < 2 caractères", () => {
    render(<TutorielSearch />)
    const input = screen.getByPlaceholderText('Rechercher dans les tutoriels...') as HTMLInputElement
    expect(input.value).toBe('')
    fireEvent.change(input, { target: { value: 'r' } })
    expect(input.value).toBe('r')
    expect(mockSearchModules).not.toHaveBeenCalled()
    expect(screen.queryByText('Aucun résultat trouvé.')).toBeNull()
    expect(screen.queryByText('Introduction')).toBeNull()
    expect(screen.queryByText('Approfondissement')).toBeNull()
  })

  it('affiche les résultats et navigue lors de la sélection', () => {
    render(<TutorielSearch />)
    const input = screen.getByPlaceholderText('Rechercher dans les tutoriels...') as HTMLInputElement

    fireEvent.change(input, { target: { value: 're' } })
    expect(input.value).toBe('re')
    expect(mockSearchModules).toHaveBeenCalledWith('re')

    expect(screen.getByText('Introduction')).toBeInTheDocument()
    expect(screen.getByText('Les bases du tutoriel')).toBeInTheDocument()
    expect(screen.getByText('Approfondissement')).toBeInTheDocument()
    expect(screen.getByText('Aller plus loin')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Introduction'))
    expect(mockNavigate).toHaveBeenCalledWith('/tutoriels/m1')

    // L'entrée est vidée et les résultats disparaissent
    expect((screen.getByPlaceholderText('Rechercher dans les tutoriels...') as HTMLInputElement).value).toBe('')
    expect(screen.queryByText('Introduction')).toBeNull()
    expect(screen.queryByText('Approfondissement')).toBeNull()
  })

  it("affiche l'état vide quand aucun résultat n'est trouvé", () => {
    render(<TutorielSearch />)
    const input = screen.getByPlaceholderText('Rechercher dans les tutoriels...') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'zz' } })
    expect(input.value).toBe('zz')
    expect(mockSearchModules).toHaveBeenCalledWith('zz')
    expect(screen.getByText('Aucun résultat trouvé.')).toBeInTheDocument()
    expect(screen.queryByText('Introduction')).toBeNull()
    expect(screen.queryByText('Approfondissement')).toBeNull()
  })
})