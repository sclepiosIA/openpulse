import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TutorielTip } from './TutorielTip'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return Wrapper
}

describe('TutorielTip', () => {
  it('affiche le titre "Astuce" et le contenu fourni', () => {
    const Wrapper = createWrapper()
    const content = 'Contenu de test'

    render(
      <TutorielTip content={content} />,
      {
        wrapper: Wrapper,
      }
    )

    expect(screen.getByText('Astuce')).toBeInTheDocument()
    expect(screen.getByText(content)).toBeInTheDocument()
  })

  it('met à jour le contenu lorsqu’il change', () => {
    const Wrapper = createWrapper()

    const { rerender } = render(
      <TutorielTip content="Premier contenu" />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText('Premier contenu')).toBeInTheDocument()

    rerender(<TutorielTip content="Second contenu" />)

    expect(screen.queryByText('Premier contenu')).toBeNull()
    expect(screen.getByText('Second contenu')).toBeInTheDocument()
  })
})