import { act, cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { TutorielAnimatedDemo } from './TutorielAnimatedDemo'

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

const renderWithProviders = (ui: ReactElement) => {
  const queryClient = createQueryClient()

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const getRoot = (container: HTMLElement): HTMLElement => {
  const root = container.firstElementChild

  if (!(root instanceof HTMLElement)) {
    throw new Error('Expected TutorielAnimatedDemo root element')
  }

  return root
}

const findCursorByPosition = (root: HTMLElement, x: number, y: number): HTMLElement => {
  const expectedLeft = `${x}%`
  const expectedTop = `${y}%`

  for (const element of Array.from(root.querySelectorAll('div'))) {
    if (element instanceof HTMLElement && element.style.left === expectedLeft && element.style.top === expectedTop) {
      return element
    }
  }

  throw new Error(`Expected cursor at ${expectedLeft}, ${expectedTop}`)
}

const hasClassFragment = (root: HTMLElement, fragment: string): boolean =>
  Array.from(root.querySelectorAll('*')).some((element) => element.getAttribute('class')?.includes(fragment) ?? false)

describe('TutorielAnimatedDemo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('rend le contenu, les classes de conteneur et le libellé initial', () => {
    const steps = [
      { type: 'move' as const, x: 20, y: 25, duration: 300, label: 'Départ guidé' },
      { type: 'wait' as const, duration: 300, label: 'Patientez' },
    ]

    const { container } = renderWithProviders(
      <TutorielAnimatedDemo steps={steps} className="custom-panel">
        <div data-testid="demo-child">Contenu principal du tutoriel</div>
      </TutorielAnimatedDemo>,
    )

    const root = getRoot(container)
    const rootClass = root.getAttribute('class') ?? ''

    expect(screen.getByTestId('demo-child').textContent).toBe('Contenu principal du tutoriel')
    expect(screen.getByText('Départ guidé').textContent).toBe('Départ guidé')
    expect(rootClass).toContain('relative')
    expect(rootClass).toContain('overflow-hidden')
    expect(rootClass).toContain('rounded-xl')
    expect(rootClass).toContain('custom-panel')
    expect(findCursorByPosition(root, 20, 25).style.transform).toBe('translate(-50%, -50%)')
  })

  it('désactive la progression automatique quand autoPlay vaut false', async () => {
    const steps = [
      { type: 'move' as const, x: 12, y: 34, duration: 100, label: 'Position non jouée' },
      { type: 'wait' as const, duration: 100, label: 'Étape suivante' },
    ]

    const { container } = renderWithProviders(
      <TutorielAnimatedDemo steps={steps} autoPlay={false}>
        <button type="button">Action visible</button>
      </TutorielAnimatedDemo>,
    )

    const root = getRoot(container)

    expect(screen.getByText('Position non jouée').textContent).toBe('Position non jouée')
    expect(screen.getByText('Action visible').tagName).toBe('BUTTON')
    expect(findCursorByPosition(root, 50, 50).style.left).toBe('50%')

    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByText('Position non jouée').textContent).toBe('Position non jouée')
    expect(findCursorByPosition(root, 50, 50).style.top).toBe('50%')
  })

  it('avance dans les étapes, déplace le curseur et affiche le highlight', async () => {
    const steps = [
      { type: 'move' as const, x: 10, y: 20, duration: 100, label: 'Déplacer le curseur' },
      { type: 'highlight' as const, x: 70, y: 80, duration: 200, label: 'Zone importante' },
    ]

    const { container } = renderWithProviders(
      <TutorielAnimatedDemo steps={steps} loop>
        <section>Interface démontrée</section>
      </TutorielAnimatedDemo>,
    )

    const root = getRoot(container)

    expect(screen.getByText('Déplacer le curseur').textContent).toBe('Déplacer le curseur')
    expect(findCursorByPosition(root, 10, 20).style.left).toBe('10%')
    expect(hasClassFragment(root, 'bg-primary/10')).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(screen.getByText('Zone importante').textContent).toBe('Zone importante')
    expect(findCursorByPosition(root, 70, 80).style.top).toBe('80%')
    expect(hasClassFragment(root, 'bg-primary/10')).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByText('Déplacer le curseur').textContent).toBe('Déplacer le curseur')
    expect(findCursorByPosition(root, 10, 20).style.left).toBe('10%')
    expect(hasClassFragment(root, 'bg-primary/10')).toBe(false)
  })

  it('affiche puis retire le retour visuel de clic au milieu de la durée', async () => {
    const steps = [{ type: 'click' as const, x: 30, y: 40, duration: 200, label: 'Cliquer ici' }]

    const { container } = renderWithProviders(
      <TutorielAnimatedDemo steps={steps}>
        <div>Carte interactive</div>
      </TutorielAnimatedDemo>,
    )

    const root = getRoot(container)
    const cursor = findCursorByPosition(root, 30, 40)

    expect(screen.getByText('Cliquer ici').textContent).toBe('Cliquer ici')
    expect(cursor.getAttribute('class') ?? '').not.toContain('scale-90')
    expect(hasClassFragment(root, 'animate-ping')).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(cursor.getAttribute('class') ?? '').toContain('scale-90')
    expect(hasClassFragment(root, 'animate-ping')).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(cursor.getAttribute('class') ?? '').not.toContain('scale-90')
    expect(hasClassFragment(root, 'animate-ping')).toBe(false)
  })

  it('supporte une liste vide sans afficher de libellé ni changer la position par défaut', async () => {
    const { container } = renderWithProviders(
      <TutorielAnimatedDemo steps={[]}>
        <div data-testid="empty-demo-child">Tutoriel sans étapes</div>
      </TutorielAnimatedDemo>,
    )

    const root = getRoot(container)

    expect(screen.getByTestId('empty-demo-child').textContent).toBe('Tutoriel sans étapes')
    expect(root.textContent).toBe('Tutoriel sans étapes')
    expect(findCursorByPosition(root, 50, 50).style.top).toBe('50%')

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })

    expect(root.textContent).toBe('Tutoriel sans étapes')
    expect(findCursorByPosition(root, 50, 50).style.left).toBe('50%')
  })
})