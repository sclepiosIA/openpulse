// @vitest-environment jsdom

import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Button, buttonVariants } from './button'

const { cnMock } = vi.hoisted(() => ({
  cnMock: vi.fn((...classes: Array<string | null | undefined | false>) =>
    classes.filter(Boolean).join(' ')
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('button.tsx', () => {
  it('rend un bouton natif avec les classes par défaut et le texte', () => {
    const Wrapper = createWrapper()

    render(<Button>Envoyer</Button>, { wrapper: Wrapper })

    const button = screen.getByRole('button', { name: 'Envoyer' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('class')
    expect(button.className).toContain('bg-primary')
    expect(button.className).toContain('text-primary-foreground')
    expect(button.className).toContain('h-controle')
    expect(button.className).toContain('px-3.5')
    expect(button.className).toContain('min-h-tactile')
    expect(button.className).toContain('md:min-h-0')
    expect(cnMock).toHaveBeenCalled()
  })

  it('applique les variantes métier réelles destructive + lg + className custom', () => {
    const Wrapper = createWrapper()

    render(
      <Button variant="destructive" size="lg" className="extra-class">
        Supprimer
      </Button>,
      { wrapper: Wrapper }
    )

    const button = screen.getByRole('button', { name: 'Supprimer' })
    expect(button.className).toContain('bg-destructive')
    expect(button.className).toContain('text-destructive-foreground')
    expect(button.className).toContain('h-champ')
    expect(button.className).toContain('px-5')
    expect(button.className).toContain('min-h-tactile')
    expect(button.className).toContain('extra-class')
  })

  it('propage les props HTML natives comme disabled et type', () => {
    const Wrapper = createWrapper()

    render(
      <Button disabled type="submit">
        Sauvegarder
      </Button>,
      { wrapper: Wrapper }
    )

    const button = screen.getByRole('button', { name: 'Sauvegarder' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('type', 'submit')
  })

  it("rend le Slot quand asChild=true en conservant les classes sur l'enfant", () => {
    const Wrapper = createWrapper()

    render(
      <Button asChild variant="link" size="sm">
        <a href="/profil">Profil</a>
      </Button>,
      { wrapper: Wrapper }
    )

    const link = screen.getByRole('link', { name: 'Profil' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/profil')
    expect(link.className).toContain('text-primary')
    expect(link.className).toContain('underline-offset-4')
    expect(link.className).toContain('h-controle')
    expect(link.className).toContain('px-3')
    expect(link.className).toContain('min-h-tactile')
  })

  it('expose buttonVariants avec les classes attendues pour outline + icon', () => {
    const classes = buttonVariants({ variant: 'outline', size: 'icon' })

    expect(classes).toContain('border')
    expect(classes).toContain('border-input')
    expect(classes).toContain('bg-background')
    expect(classes).toContain('hover:bg-accent')
    expect(classes).toContain('h-controle')
    expect(classes).toContain('w-[34px]')
    expect(classes).toContain('min-w-[44px]')
    expect(classes).toContain('md:min-w-0')
  })

  it('définit un displayName explicite pour le composant forwardRef', () => {
    expect(Button.displayName).toBe('Button')
  })

  it('transmet correctement la ref vers le bouton natif', () => {
    const Wrapper = createWrapper()
    const ref = React.createRef<HTMLButtonElement>()

    render(<Button ref={ref}>Ref test</Button>, { wrapper: Wrapper })

    const button = screen.getByRole('button', { name: 'Ref test' })
    expect(ref.current).toBe(button)
  })
})
