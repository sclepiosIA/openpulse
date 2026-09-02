// Génération PDF/A-3 Factur-X côté client (PDF avec XML CII embarqué)
import { PDFDocument, StandardFonts, rgb, AFRelationship } from 'pdf-lib'

export interface FacturXInput {
  numero: string
  date: string
  emetteur: { nom: string; siren?: string; adresse?: string }
  client: { nom: string; adresse?: string; siret?: string }
  lignes: Array<{ description: string; quantite: number; prix_unitaire: number; tva_taux: number }>
  total_ht: number
  total_tva: number
  total_ttc: number
  xml_cii: string
  profile?: 'MINIMUM' | 'BASIC WL' | 'BASIC' | 'EN 16931' | 'EXTENDED'
}

const eur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)

export async function generateFacturXPdf(input: FacturXInput): Promise<Blob> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842]) // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let y = 800
  const draw = (t: string, x: number, size = 10, f = font) => {
    page.drawText(t, { x, y, size, font: f, color: rgb(0, 0, 0) })
  }

  // En-tête
  draw(`FACTURE ${input.numero}`, 40, 18, bold)
  y -= 24
  draw(`Date : ${input.date}`, 40)
  y -= 30

  // Émetteur / Client
  draw('Émetteur', 40, 11, bold)
  draw('Client', 320, 11, bold)
  y -= 16
  const emLines = [
    input.emetteur.nom,
    input.emetteur.siren ? `SIREN ${input.emetteur.siren}` : '',
    input.emetteur.adresse || '',
  ].filter(Boolean)
  const clLines = [
    input.client.nom,
    input.client.siret ? `SIRET ${input.client.siret}` : '',
    input.client.adresse || '',
  ].filter(Boolean)
  const maxLines = Math.max(emLines.length, clLines.length)
  for (let i = 0; i < maxLines; i++) {
    if (emLines[i]) draw(emLines[i], 40, 9)
    if (clLines[i]) draw(clLines[i], 320, 9)
    y -= 12
  }
  y -= 20

  // Lignes
  draw('Description', 40, 10, bold)
  draw('Qté', 320, 10, bold)
  draw('PU HT', 370, 10, bold)
  draw('TVA', 440, 10, bold)
  draw('Total HT', 490, 10, bold)
  y -= 6
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5 })
  y -= 12

  for (const l of input.lignes) {
    const ht = l.quantite * l.prix_unitaire
    draw(l.description.slice(0, 45), 40, 9)
    draw(String(l.quantite), 320, 9)
    draw(eur(l.prix_unitaire), 370, 9)
    draw(`${l.tva_taux}%`, 440, 9)
    draw(eur(ht), 490, 9)
    y -= 14
    if (y < 150) break
  }

  y -= 20
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5 })
  y -= 20
  draw('Total HT', 400, 10, bold)
  draw(eur(input.total_ht), 490, 10)
  y -= 14
  draw('Total TVA', 400, 10, bold)
  draw(eur(input.total_tva), 490, 10)
  y -= 14
  draw('Total TTC', 400, 11, bold)
  draw(eur(input.total_ttc), 490, 11, bold)

  // Métadonnées PDF/A-3 minimales
  pdf.setTitle(`Facture ${input.numero}`)
  pdf.setAuthor(input.emetteur.nom)
  pdf.setSubject('Facture électronique Factur-X')
  pdf.setKeywords(['facture', 'factur-x', 'e-invoice'])
  pdf.setProducer('OpenPulse - Factur-X')
  pdf.setCreator('OpenPulse')

  // Embed XML CII en tant que pièce jointe (Factur-X profile)
  const xmlBytes = new TextEncoder().encode(input.xml_cii)
  await pdf.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Factur-X XML CII',
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Alternative,
  })

  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
