import { NOTE_COLORS, NOTE_COLOR_LABELS, NOTE_COLOR_TOKENS, getNoteColorTokens } from './noteColors'

describe('noteColors', () => {
  describe('NOTE_COLORS', () => {
    it('expose les couleurs disponibles dans l’ordre attendu', () => {
      expect(NOTE_COLORS).toEqual(['yellow', 'pink', 'blue', 'green', 'orange', 'purple', 'gray'])
      expect(NOTE_COLORS).toHaveLength(7)
    })

    it('ne contient aucun doublon', () => {
      expect(new Set(NOTE_COLORS).size).toBe(NOTE_COLORS.length)
    })
  })

  describe('NOTE_COLOR_LABELS', () => {
    it('contient un libellé français pour chaque couleur', () => {
      expect(NOTE_COLOR_LABELS).toEqual({
        yellow: 'Jaune',
        pink: 'Rose',
        blue: 'Bleu',
        green: 'Vert',
        orange: 'Orange',
        purple: 'Violet',
        gray: 'Gris',
      })
    })

    it('utilise exactement les mêmes clés que NOTE_COLORS', () => {
      expect(Object.keys(NOTE_COLOR_LABELS).sort()).toEqual([...NOTE_COLORS].sort())
    })
  })

  describe('NOTE_COLOR_TOKENS', () => {
    it('utilise exactement les mêmes clés que NOTE_COLORS', () => {
      expect(Object.keys(NOTE_COLOR_TOKENS).sort()).toEqual([...NOTE_COLORS].sort())
    })

    it('définit toutes les clés de tokens attendues pour chaque couleur', () => {
      const expectedTokenKeys = [
        'paper',
        'paperEdge',
        'band',
        'accent',
        'ink',
        'tabIdle',
        'tabActive',
        'tabActiveText',
        'swatch',
      ]

      for (const color of NOTE_COLORS) {
        expect(Object.keys(NOTE_COLOR_TOKENS[color]).sort()).toEqual([...expectedTokenKeys].sort())
      }
    })

    it('contient uniquement des couleurs hexadécimales RGB en majuscules', () => {
      const hexRgbColorPattern = /^#[0-9A-F]{6}$/

      for (const color of NOTE_COLORS) {
        for (const tokenValue of Object.values(NOTE_COLOR_TOKENS[color])) {
          expect(tokenValue).toMatch(hexRgbColorPattern)
        }
      }
    })

    it('contient les tokens exacts pour la couleur jaune', () => {
      expect(NOTE_COLOR_TOKENS.yellow).toEqual({
        paper: '#FEF9C3',
        paperEdge: '#FDE68A',
        band: '#EAB308',
        accent: '#CA8A04',
        ink: '#713F12',
        tabIdle: '#FEF3C7',
        tabActive: '#FDE68A',
        tabActiveText: '#713F12',
        swatch: '#FACC15',
      })
    })

    it('contient les tokens exacts pour la couleur bleue', () => {
      expect(NOTE_COLOR_TOKENS.blue).toEqual({
        paper: '#DBEAFE',
        paperEdge: '#BFDBFE',
        band: '#3B82F6',
        accent: '#2563EB',
        ink: '#1E3A8A',
        tabIdle: '#DBEAFE',
        tabActive: '#BFDBFE',
        tabActiveText: '#1E3A8A',
        swatch: '#60A5FA',
      })
    })

    it('contient les tokens exacts pour la couleur grise', () => {
      expect(NOTE_COLOR_TOKENS.gray).toEqual({
        paper: '#F1F5F9',
        paperEdge: '#E2E8F0',
        band: '#64748B',
        accent: '#475569',
        ink: '#1E293B',
        tabIdle: '#F1F5F9',
        tabActive: '#E2E8F0',
        tabActiveText: '#1E293B',
        swatch: '#94A3B8',
      })
    })
  })

  describe('getNoteColorTokens', () => {
    it.each(NOTE_COLORS)('retourne les tokens de référence pour %s', (color) => {
      expect(getNoteColorTokens(color)).toBe(NOTE_COLOR_TOKENS[color])
    })

    it('retourne les tokens jaunes quand la couleur est null', () => {
      expect(getNoteColorTokens(null)).toBe(NOTE_COLOR_TOKENS.yellow)
    })

    it('retourne les tokens jaunes quand la couleur est undefined', () => {
      expect(getNoteColorTokens(undefined)).toBe(NOTE_COLOR_TOKENS.yellow)
    })

    it('retourne les tokens jaunes pour une couleur inconnue à l’exécution', () => {
      const unknownRuntimeColor = 'red' as Parameters<typeof getNoteColorTokens>[0]

      expect(getNoteColorTokens(unknownRuntimeColor)).toBe(NOTE_COLOR_TOKENS.yellow)
    })
  })
})
