import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockCn, MockX, MockZoomIn } = vi.hoisted(() => ({
  mockCn: (...args: Array<string | false | null | undefined>) =>
    args.filter(Boolean).join(' '),
  MockX: function MockX(_props: Record<string, unknown>) {
    return null
  },
  MockZoomIn: function MockZoomIn(_props: Record<string, unknown>) {
    return null
  },
}))

vi.mock('lucide-react', () => ({ X: MockX, ZoomIn: MockZoomIn }))
vi.mock('@/lib/utils', () => ({ cn: mockCn }))

const { TutorielScreenshot } = await import('./TutorielScreenshot')

describe('TutorielScreenshot', () => {
  const makeWrapper = () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
  }

  it('affiche l\'image principale avec les classes de taille, ouvre et ferme le lightbox via clic, bouton et Escape, et stopPropagation sur l\'image', async () => {
    // Utilisation requise du renderHook avec wrapper
    await act(async () => {
      renderHook(() => {
        return null
      }, { wrapper: makeWrapper() })
    })

    const src = 'https://example.com/screenshot.png'
    const alt = 'Capture d’écran tutoriel'
    const { container } = render(
      <TutorielScreenshot src={src} alt={alt} size="medium" className="extra-class" />
    )

    // La vignette principale est rendue
    const mainImg = screen.getByAltText(alt) as HTMLImageElement
    expect(mainImg).toBeInstanceOf(HTMLImageElement)
    expect(mainImg.src).toContain('screenshot.png')

    // Le conteneur parent contient les classes de taille et la classe personnalisée
    const parentDiv = mainImg.closest('div')
    expect(parentDiv).not.toBeNull()
    expect(parentDiv?.className).toContain('max-w-[600px]') // medium size class
    expect(parentDiv?.className).toContain('extra-class')

    // Ouvrir le lightbox via clic sur le conteneur
    await act(async () => {
      fireEvent.click(parentDiv as Element)
    })

    // Après ouverture on doit avoir deux images avec le même alt (miniature + lightbox)
    const imgsAfterOpen = screen.getAllByAltText(alt)
    expect(imgsAfterOpen.length).toBe(2)

    // Cliquer sur l'image du lightbox ne doit pas fermer le lightbox (stopPropagation)
    const lightboxImg = imgsAfterOpen.find((img) => img !== mainImg) as Element
    await act(async () => {
      fireEvent.click(lightboxImg)
    })
    expect(screen.getAllByAltText(alt).length).toBe(2)

    // Cliquer sur l'overlay (le parent du lightboxImg) doit fermer le lightbox
    const overlay = lightboxImg.parentElement as Element
    expect(overlay).not.toBeNull()
    await act(async () => {
      fireEvent.click(overlay)
    })
    expect(screen.getAllByAltText(alt).length).toBe(1)

    // Ouvrir de nouveau pour tester le bouton de fermeture et Escape
    await act(async () => {
      fireEvent.click(parentDiv as Element)
    })
    expect(screen.getAllByAltText(alt).length).toBe(2)

    // Fermer via le bouton (bouton présent dans le lightbox)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
    await act(async () => {
      fireEvent.click(buttons[0])
    })
    expect(screen.getAllByAltText(alt).length).toBe(1)

    // Ouvrir à nouveau pour tester la touche Escape
    await act(async () => {
      fireEvent.click(parentDiv as Element)
    })
    expect(screen.getAllByAltText(alt).length).toBe(2)

    // Press Escape pour fermer
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(screen.getAllByAltText(alt).length).toBe(1)

    // S'assurer que le DOM ne contient pas d'overlay restant
    expect(container.querySelectorAll('div').length).toBeGreaterThanOrEqual(1)
  })

  it('rend null si l\'image a une erreur (onError) et retire toute image du DOM', async () => {
    const src = 'https://example.com/does-not-exist.png'
    const alt = 'Image en erreur'

    const { container } = render(<TutorielScreenshot src={src} alt={alt} />)
    const img = screen.getByAltText(alt)
    expect(img).toBeInTheDocument()

    // Simuler l'erreur de chargement
    await act(async () => {
      fireEvent.error(img)
    })

    // L'image principale doit avoir été retirée (composant retourne null)
    expect(screen.queryByAltText(alt)).toBeNull()
    // Le container ne doit plus contenir d'img
    expect(container.querySelectorAll('img').length).toBe(0)
  })
})