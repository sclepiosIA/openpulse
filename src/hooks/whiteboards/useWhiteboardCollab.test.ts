import { describe, it, expect } from 'vitest'
import { mergeElements, diffElements } from './useWhiteboardCollab'

describe('mergeElements', () => {
  it('conserve les éléments locaux absents du flux distant', () => {
    const merged = mergeElements(
      [
        { id: 'a', version: 1 },
        { id: 'b', version: 3 },
      ],
      [{ id: 'c', version: 1 }]
    )
    expect(merged.map((e) => e.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('garde la version la plus élevée en cas de conflit', () => {
    const merged = mergeElements(
      [{ id: 'a', version: 5, text: 'local' }],
      [{ id: 'a', version: 2, text: 'distant' }]
    )
    expect(merged[0].text).toBe('local')
  })

  it('applique les suppressions distantes', () => {
    const merged = mergeElements(
      [{ id: 'a', version: 1 }],
      [{ id: 'a', version: 2, isDeleted: true }]
    )
    expect(merged).toHaveLength(0)
  })
})

describe('diffElements', () => {
  it('ne renvoie que les éléments nouveaux ou modifiés', () => {
    const previous = new Map<string, number>([
      ['a', 1],
      ['b', 2],
    ])
    const changed = diffElements(previous, [
      { id: 'a', version: 1 },
      { id: 'b', version: 3 },
      { id: 'c', version: 1 },
    ])
    expect(changed.map((e) => e.id).sort()).toEqual(['b', 'c'])
  })

  it('renvoie une liste vide quand rien ne change', () => {
    const previous = new Map<string, number>([['a', 1]])
    expect(diffElements(previous, [{ id: 'a', version: 1 }])).toHaveLength(0)
  })
})
