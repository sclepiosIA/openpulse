import { describe, expect, it } from 'vitest'
import { isWhiteboardTextEditing } from './whiteboardEditingGuard'

describe('isWhiteboardTextEditing', () => {
  it.each([
    ['un texte', { editingTextElement: { id: 'text-1' } }],
    ['un élément', { editingElement: { id: 'element-1' } }],
    ['un nouvel élément', { newElement: { id: 'new-1' } }],
    ['une ligne', { editingLinearElement: { id: 'line-1' } }],
  ])('protège la saisie Excalidraw pendant l’édition de %s', (_label, appState) => {
    const api = { getAppState: () => appState }

    expect(isWhiteboardTextEditing(api, null)).toBe(true)
  })

  it('protège la saisie quand Excalidraw utilise son éditeur DOM', () => {
    const api = { getAppState: () => ({}) }
    const activeElement = document.createElement('div')
    activeElement.classList.add('excalidraw-wysiwyg')

    expect(isWhiteboardTextEditing(api, activeElement)).toBe(true)
  })

  it('autorise les mises à jour de scène hors édition', () => {
    const api = { getAppState: () => ({}) }

    expect(isWhiteboardTextEditing(api, document.createElement('button'))).toBe(false)
  })
})