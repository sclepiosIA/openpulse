// @vitest-environment jsdom

import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDocContext } from './useDocContext'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }

  return Wrapper
}

describe('useDocContext', () => {
  it('retourne les valeurs par défaut avec un résumé racine vide', () => {
    const { result } = renderHook(() => useDocContext({}), {
      wrapper: createWrapper(),
    })

    expect(result.current.title).toBe('Sans titre')
    expect(result.current.summary).toBe('Titre: Sans titre\nDossier: (racine)\nLongueur: 0 mots')
  })

  it('nettoie le HTML, supprime script/style et construit le résumé métier attendu', () => {
    const html = [
      '<style>.hidden{display:none}</style>',
      "<script>console.log('x')</script>",
      '<h1>Bonjour <strong>le</strong> monde</h1>',
      '<p>Voici un test simple.</p>',
    ].join('')

    const { result } = renderHook(
      () =>
        useDocContext({
          documentName: 'Compte rendu',
          documentHtml: html,
          folderId: 'folder-1',
        }),
      { wrapper: createWrapper() }
    )

    expect(result.current.title).toBe('Compte rendu')
    expect(result.current.summary).toBe(
      'Titre: Compte rendu\nDossier: folder-1\nLongueur: 7 mots\nExtrait: Bonjour le monde Voici un test simple.'
    )
    expect(result.current.summary).not.toContain('console.log')
    expect(result.current.summary).not.toContain('display:none')
  })

  it("limite l'extrait à 60 mots et ajoute une ellipse si le contenu est plus long", () => {
    const words = Array.from({ length: 65 }, (_, i) => `mot${i + 1}`).join(' ')
    const html = `<div>${words}</div>`
    const expectedPreview = Array.from({ length: 60 }, (_, i) => `mot${i + 1}`).join(' ')

    const { result } = renderHook(
      () =>
        useDocContext({
          documentName: 'Doc long',
          documentHtml: html,
          folderId: null,
        }),
      { wrapper: createWrapper() }
    )

    expect(result.current.title).toBe('Doc long')
    expect(result.current.summary).toBe(
      `Titre: Doc long\nDossier: (racine)\nLongueur: 65 mots\nExtrait: ${expectedPreview}…`
    )
    expect(result.current.summary).not.toContain('mot61')
  })

  it('recalcule le résumé quand les options changent', () => {
    const { result, rerender } = renderHook(
      (props: { documentName?: string; documentHtml?: string; folderId?: string | null }) =>
        useDocContext(props),
      {
        initialProps: {
          documentName: 'Premier',
          documentHtml: '<p>alpha beta</p>',
          folderId: 'f-1',
        },
        wrapper: createWrapper(),
      }
    )

    expect(result.current.title).toBe('Premier')
    expect(result.current.summary).toBe(
      'Titre: Premier\nDossier: f-1\nLongueur: 2 mots\nExtrait: alpha beta'
    )

    rerender({
      documentName: 'Second',
      documentHtml: '<div>gamma <b>delta</b> epsilon</div>',
      folderId: undefined,
    })

    expect(result.current.title).toBe('Second')
    expect(result.current.summary).toBe(
      'Titre: Second\nDossier: (racine)\nLongueur: 3 mots\nExtrait: gamma delta epsilon'
    )
  })

  it('préserve le titre fourni même quand le html est vide', () => {
    const { result } = renderHook(
      () =>
        useDocContext({
          documentName: 'Note interne',
          documentHtml: '',
          folderId: 'd-9',
        }),
      { wrapper: createWrapper() }
    )

    expect(result.current.title).toBe('Note interne')
    expect(result.current.summary).toBe('Titre: Note interne\nDossier: d-9\nLongueur: 0 mots')
  })
})
