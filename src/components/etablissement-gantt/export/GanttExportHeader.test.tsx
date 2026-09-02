import React from 'react'
import { render, screen } from '@testing-library/react'
import { GanttExportHeader, generateGanttExportHeaderHTML } from './GanttExportHeader'

describe('generateGanttExportHeaderHTML', () => {
  it('génère un HTML avec les dates formatées en français et le contenu statique attendu', () => {
    const props = {
      etablissementNom: 'Centre Médical de Paris',
      dateDebut: new Date(2024, 2, 10), // 10 mars 2024
      dateFin: new Date(2024, 2, 20), // 20 mars 2024
      dateExport: new Date(2024, 2, 5), // 05 mars 2024
    }
    const html = generateGanttExportHeaderHTML(props)

    expect(html).toContain('OpenPulse')
    expect(html).toContain('Solutions Médicales Intelligentes')
    expect(html).toContain('Planning de Déploiement')
    expect(html).toContain('Document généré le')
    expect(html).toContain('05 mars 2024')
    expect(html).toContain('Période : 10 mars 2024 - 20 mars 2024')
    expect(html).toContain('Centre Médical de Paris')
  })

  it("échappe correctement le nom d'établissement potentiellement malveillant", () => {
    const props = {
      etablissementNom: `Hopital "Alpha" <script>alert('x')</script> & Co'`,
      dateDebut: new Date(2024, 2, 10),
      dateFin: new Date(2024, 2, 20),
      dateExport: new Date(2024, 2, 5),
    }
    const html = generateGanttExportHeaderHTML(props)

    // Vérifie l'échappement HTML
    expect(html).toContain('Hopital &quot;Alpha&quot; &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; Co&#39;')
    // Ne doit pas contenir les tags bruts
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('</script>')
    expect(html).not.toContain('onerror=')
  })

  it('lève une erreur si une date invalide est fournie', () => {
    const props = {
      etablissementNom: 'Test',
      dateDebut: new Date('invalid'),
      dateFin: new Date(2024, 2, 20),
      dateExport: new Date(2024, 2, 5),
    } as unknown as Parameters<typeof generateGanttExportHeaderHTML>[0]

    expect(() => generateGanttExportHeaderHTML(props)).toThrow()
  })
})

describe('GanttExportHeader (React component)', () => {
  it('rend les textes et dates formatées attendus', () => {
    render(
      <GanttExportHeader
        etablissementNom="Centre Médical de Paris"
        dateDebut={new Date(2024, 2, 10)}
        dateFin={new Date(2024, 2, 20)}
        dateExport={new Date(2024, 2, 5)}
      />
    )

    expect(screen.getByText('OpenPulse')).toBeTruthy()
    expect(screen.getByText('Solutions Médicales Intelligentes')).toBeTruthy()
    expect(screen.getByText('Planning de Déploiement')).toBeTruthy()
    expect(screen.getByText('Document généré le')).toBeTruthy()

    // Dates formatées
    expect(screen.getByText('05 mars 2024')).toBeTruthy()
    expect(screen.getByText('Période : 10 mars 2024 - 20 mars 2024')).toBeTruthy()

    // Nom d'établissement
    expect(screen.getByText('Centre Médical de Paris')).toBeTruthy()
  })

  it("affiche le nom d'établissement comme texte (pas d'injection HTML)", () => {
    const malicious = '<b>H</b>ôpital & Co'
    render(
      <GanttExportHeader
        etablissementNom={malicious}
        dateDebut={new Date(2024, 2, 10)}
        dateFin={new Date(2024, 2, 20)}
        dateExport={new Date(2024, 2, 5)}
      />
    )

    // Le texte brut doit apparaître, pas de balises interprétées
    expect(screen.getByText(malicious)).toBeTruthy()

    // Et il ne doit pas exister d'élément <b> injecté
    const boldElements = document.querySelectorAll('b')
    expect(boldElements.length).toBe(0)
  })
})