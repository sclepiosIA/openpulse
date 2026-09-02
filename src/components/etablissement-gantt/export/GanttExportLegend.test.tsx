import { describe, it, expect } from 'vitest'
import { generateGanttExportLegendHTML } from './GanttExportLegend'

describe('GanttExportLegend - generateGanttExportLegendHTML', () => {
  it('generates HTML with escaped labels and correct colors', () => {
    const categories: { id: string; nom: string; couleur: string | null }[] = [
      { id: 'c1', nom: 'Alpha & <Test>', couleur: '#ff0000' },
      { id: 'c2', nom: 'Beta', couleur: null },
    ]
    const stats = {
      total: 5,
      parStatut: {
        'A faire': 1,
        'En cours': 2,
        Bloqué: 0,
        Terminé: 2,
      } as Record<string, number>,
      enRetard: 1,
    } as const

    // @ts-ignore: test data structure compatible with the function signature
    const html = generateGanttExportLegendHTML({ categories, stats })

    // Escaped label test
    expect(html).toContain('Alpha &amp; &lt;Test&gt;')

    // Colors: explicit color and fallback
    expect(html).toContain('background: #ff0000')
    expect(html).toContain('background: #6B7280')

    // Total and retard indicator
    expect(html).toContain('Total des tâches')
    expect(html).toContain('5')
    expect(html).toContain('1 tâche en retard')
  })

  it('omits the retard row when enRetard is 0', () => {
    const categories: { id: string; nom: string; couleur: string | null }[] = [
      { id: 'c1', nom: 'Gamma', couleur: '#00ff00' },
    ]
    const stats = {
      total: 3,
      parStatut: {
        'A faire': 0,
        'En cours': 1,
        Bloqué: 0,
        Terminé: 2,
      } as Record<string, number>,
      enRetard: 0,
    } as const

    // @ts-ignore: test data structure compatible with the function signature
    const html = generateGanttExportLegendHTML({ categories, stats })

    // Ensure the retard line is not rendered
    expect(html).not.toContain('tâche en retard')
  })
})