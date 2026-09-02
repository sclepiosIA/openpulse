// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PolitiqueConfidentialite from './PolitiqueConfidentialite'

const { MARKDOWN, ReactMarkdownMock, remarkGfmMock } = vi.hoisted(() => {
  const ReactMarkdownImpl = vi.fn(
    ({ children }: { children?: React.ReactNode; remarkPlugins?: unknown[] }) => (
      <div data-testid="react-markdown">{children}</div>
    )
  )

  return {
    MARKDOWN: '# Politique\n\nNous respectons vos données personnelles.',
    ReactMarkdownMock: ReactMarkdownImpl,
    remarkGfmMock: vi.fn(() => undefined),
  }
})

vi.mock('@/content/legal', () => ({
  POLITIQUE_CONFIDENTIALITE_MD: MARKDOWN,
}))

vi.mock('react-markdown', () => ({
  default: ReactMarkdownMock,
}))

vi.mock('remark-gfm', () => ({
  default: remarkGfmMock,
}))

describe('PolitiqueConfidentialite', () => {
  let queryClient: QueryClient

  const Wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    ReactMarkdownMock.mockClear()
    remarkGfmMock.mockClear()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
  })

  it('rend le contenu markdown réel provenant du module legal', () => {
    render(<PolitiqueConfidentialite />, { wrapper: Wrapper })

    const markdown = screen.getByTestId('react-markdown')
    expect(markdown).toBeInTheDocument()
    expect(markdown).toHaveTextContent('Politique')
    expect(markdown).toHaveTextContent('Nous respectons vos données personnelles.')
  })

  it('passe le plugin remarkGfm à ReactMarkdown', () => {
    render(<PolitiqueConfidentialite />, { wrapper: Wrapper })

    expect(ReactMarkdownMock).toHaveBeenCalledTimes(1)
    const firstCall = ReactMarkdownMock.mock.calls[0]
    const props = firstCall[0] as {
      children?: React.ReactNode
      remarkPlugins?: unknown[]
    }

    expect(props.children).toBe(MARKDOWN)
    expect(props.remarkPlugins).toEqual([remarkGfmMock])
  })

  it("met à jour le titre du document au montage", async () => {
    document.title = 'Titre initial'
    render(<PolitiqueConfidentialite />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(document.title).toBe('Politique de confidentialité — OpenPulse')
    })
  })

  it('rend la structure principale de page publique', () => {
    const { container } = render(<PolitiqueConfidentialite />, { wrapper: Wrapper })

    const main = container.querySelector('main')
    const article = container.querySelector('article')

    expect(main).not.toBeNull()
    expect(main?.className).toContain('max-w-3xl')
    expect(main?.className).toContain('px-4')
    expect(article).not.toBeNull()
    expect(article?.className).toContain('prose')
    expect(article?.className).toContain('max-w-none')
  })
})