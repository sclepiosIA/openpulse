import { describe, it, expect } from 'vitest'
import { PRESENCE_STATUS_CONFIG } from './pulse'

describe('pulse.ts', () => {
  it('expose une config complète pour chaque statut de présence', () => {
    const keys = Object.keys(PRESENCE_STATUS_CONFIG).sort()
    expect(keys).toEqual(['active', 'away', 'busy', 'dnd', 'in_meeting', 'offline'].sort())

    for (const status of keys) {
      const cfg = PRESENCE_STATUS_CONFIG[status as keyof typeof PRESENCE_STATUS_CONFIG]
      expect(typeof cfg.label).toBe('string')
      expect(cfg.label.length).toBeGreaterThan(0)

      expect(typeof cfg.emoji).toBe('string')
      expect(cfg.emoji.length).toBeGreaterThan(0)

      expect(typeof cfg.color).toBe('string')
      expect(cfg.color.length).toBeGreaterThan(0)

      expect(typeof cfg.bgColor).toBe('string')
      expect(cfg.bgColor.length).toBeGreaterThan(0)

      expect(typeof cfg.description).toBe('string')
      expect(cfg.description.length).toBeGreaterThan(0)
    }
  })

  it('contient des valeurs métier attendues (labels, couleurs) pour des statuts clés', () => {
    expect(PRESENCE_STATUS_CONFIG.active).toMatchObject({
      label: 'En ligne',
      emoji: '🟢',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500',
      description: 'Disponible',
    })

    expect(PRESENCE_STATUS_CONFIG.dnd).toMatchObject({
      label: 'Ne pas déranger',
      emoji: '⛔',
      color: 'text-red-600',
      bgColor: 'bg-red-600',
      description: 'Pas de notifications',
    })

    expect(PRESENCE_STATUS_CONFIG.offline).toMatchObject({
      label: 'Hors ligne',
      emoji: '⚫',
      color: 'text-gray-400',
      bgColor: 'bg-gray-400',
      description: 'Hors ligne',
    })
  })
})