import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import { loadPdfLibs, loadExcelLibs } from '@/lib/export/dynamicPdfImport'
import { debug } from '@/lib/debug'

interface EtablissementExportData {
  id: string
  nom: string
  ville?: string
  region?: string
  type?: string
  statut: string
  commercial?: string
  csm?: string
  chef_projet?: string
  type_offre?: string
  pallier_vise?: string
  nombre_passages_urgences_annuel?: number
  progression?: number
  date_signature?: string
  date_fin_contrat?: string
  created_at: string
  valeur: number
}

interface StatsData {
  totalEtablissements: number
  prospects: number
  enProduction: number
  enDeploiement: number
  totalValeur: number
  caRealise: number
  caPrevisionnel: number
  tauxConversion: number
  progressionMoyenne: number
  totalPassages: number
  passagesProduction: number
  partMarcheActuelle: number
  partMarchePotentielle: number
  passagesRestants: number
  potentielMarcheRestant: number
  passagesNationaux: number
}

interface RegionAggregate {
  region: string
  count: number
  valeur: number
  enProduction: number
}

interface StatusAggregate {
  statut: string
  count: number
  valeur: number
}

type EtablissementRow = Record<string, unknown> & {
  id?: string
  nom?: string
  region?: string | null
  statut?: string
  valeur?: number
  commercial_id?: string | null
  csm_id?: string | null
  chef_projet_id?: string | null
}

type ProfileRow = { id: string; full_name?: string | null; display_name?: string | null; nom?: string | null }


export function exportToCSV(data: EtablissementExportData[], filename: string) {
  if (!data || data.length === 0) {
    debug.warn('No data to export')
    return
  }

  const headers = [
    'ID',
    'Nom',
    'Ville',
    'Région',
    'Type',
    'Statut',
    'Commercial',
    'CSM',
    'Chef de Projet',
    'Type Offre',
    'Pallier Visé',
    'Passages Urgences/an',
    'Progression (%)',
    'Valeur Estimée (€)',
    'Date Signature',
    'Date Fin Contrat',
    'Date Création'
  ]

  const rows = data.map(etab => [
    etab.id,
    etab.nom,
    etab.ville || '',
    etab.region || '',
    etab.type || '',
    etab.statut,
    etab.commercial || '',
    etab.csm || '',
    etab.chef_projet || '',
    etab.type_offre || '',
    etab.pallier_vise || '',
    etab.nombre_passages_urgences_annuel || 0,
    etab.progression || 0,
    Math.round(etab.valeur),
    etab.date_signature || '',
    etab.date_fin_contrat || '',
    etab.created_at ? format(new Date(etab.created_at), 'dd/MM/yyyy', { locale: fr }) : ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => {
        const value = String(cell)
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function exportToExcel(
  data: EtablissementExportData[], 
  stats: StatsData,
  filename: string
) {
  const { XLSX } = await loadExcelLibs()
  const workbook = XLSX.utils.book_new()

  // Overview sheet
  const overviewData = [
    ['RAPPORT STATISTIQUES'],
    ['Date de génération', format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })],
    [],
    ['MÉTRIQUES GÉNÉRALES'],
    ['Total Établissements', stats.totalEtablissements],
    ['Prospects', stats.prospects],
    ['En Production', stats.enProduction],
    ['En Déploiement', stats.enDeploiement],
    [],
    ['FINANCIER'],
    ['CA Réalisé', `${Math.round(stats.caRealise).toLocaleString('fr-FR')} €`],
    ['CA Prévisionnel', `${Math.round(stats.caPrevisionnel).toLocaleString('fr-FR')} €`],
    ['Valeur Totale', `${Math.round(stats.totalValeur).toLocaleString('fr-FR')} €`],
    [],
    ['PERFORMANCE'],
    ['Taux de Conversion', `${stats.tauxConversion}%`],
    ['Progression Moyenne', `${stats.progressionMoyenne}%`],
    ['Total Passages Urgences', stats.totalPassages.toLocaleString('fr-FR')],
    [],
    ['CONTEXTE MARCHÉ NATIONAL'],
    ['Passages nationaux annuels', stats.passagesNationaux.toLocaleString('fr-FR')],
    ['Passages en production', stats.passagesProduction.toLocaleString('fr-FR')],
    ['Part de marché actuelle', `${stats.partMarcheActuelle.toFixed(2)}%`],
    ['Passages pipeline total', stats.totalPassages.toLocaleString('fr-FR')],
    ['Part de marché potentielle', `${stats.partMarchePotentielle.toFixed(2)}%`],
    ['Passages restants à conquérir', stats.passagesRestants.toLocaleString('fr-FR')],
    ['Potentiel CA marché restant', `${Math.round(stats.potentielMarcheRestant).toLocaleString('fr-FR')} €`],
  ]

  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData)
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Vue d\'ensemble')

  // Details sheet
  const detailsData = data.map(etab => ({
    'ID': etab.id,
    'Nom': etab.nom,
    'Ville': etab.ville || '',
    'Région': etab.region || '',
    'Type': etab.type || '',
    'Statut': etab.statut,
    'Commercial': etab.commercial || '',
    'CSM': etab.csm || '',
    'Chef de Projet': etab.chef_projet || '',
    'Type Offre': etab.type_offre || '',
    'Pallier Visé': etab.pallier_vise || '',
    'Passages/an': etab.nombre_passages_urgences_annuel || 0,
    'Progression (%)': etab.progression || 0,
    'Valeur (€)': Math.round(etab.valeur),
    'Date Signature': etab.date_signature || '',
    'Date Fin Contrat': etab.date_fin_contrat || '',
    'Date Création': etab.created_at ? format(new Date(etab.created_at), 'dd/MM/yyyy') : ''
  }))

  const detailsSheet = XLSX.utils.json_to_sheet(detailsData)
  XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Détails')

  // By Region sheet
  const byRegion = data.reduce<Record<string, RegionAggregate>>((acc, etab) => {
    const region = etab.region || 'Non défini'
    if (!acc[region]) {
      acc[region] = { region, count: 0, valeur: 0, enProduction: 0 }
    }
    acc[region].count++
    acc[region].valeur += etab.valeur
    if (etab.statut === 'Production' || etab.statut === 'Go-Live') {
      acc[region].enProduction++
    }
    return acc
  }, {})

  const regionData = Object.values(byRegion).map((r) => ({
    'Région': r.region,
    'Nombre': r.count,
    'En Production': r.enProduction,
    'Valeur Totale (€)': Math.round(r.valeur),
    'Valeur Moyenne (€)': Math.round(r.valeur / r.count)
  }))

  const regionSheet = XLSX.utils.json_to_sheet(regionData)
  XLSX.utils.book_append_sheet(workbook, regionSheet, 'Par Région')

  // By Status sheet
  const byStatus = data.reduce<Record<string, StatusAggregate>>((acc, etab) => {
    if (!acc[etab.statut]) {
      acc[etab.statut] = { statut: etab.statut, count: 0, valeur: 0 }
    }
    acc[etab.statut].count++
    acc[etab.statut].valeur += etab.valeur
    return acc
  }, {})

  const statusData = Object.values(byStatus).map((s) => ({
    'Statut': s.statut,
    'Nombre': s.count,
    'Valeur Totale (€)': Math.round(s.valeur),
    'Pourcentage': `${Math.round((s.count / data.length) * 100)}%`
  }))


  const statusSheet = XLSX.utils.json_to_sheet(statusData)
  XLSX.utils.book_append_sheet(workbook, statusSheet, 'Par Statut')

  // Export
  XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
}

export async function exportToPDF(
  data: EtablissementExportData[],
  stats: StatsData,
  filename: string
) {
  const { jsPDF, autoTable } = await loadPdfLibs()
  const doc = new jsPDF('landscape')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Title
  doc.setFontSize(20)
  doc.text('RAPPORT STATISTIQUES', pageWidth / 2, 15, { align: 'center' })
  
  doc.setFontSize(10)
  doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`, pageWidth / 2, 22, { align: 'center' })

  // Stats summary
  let yPos = 35
  doc.setFontSize(14)
  doc.text('Vue d\'ensemble', 14, yPos)
  
  yPos += 10
  doc.setFontSize(10)
  
  const summaryData = [
    ['Métrique', 'Valeur'],
    ['Total Établissements', stats.totalEtablissements.toString()],
    ['Prospects', stats.prospects.toString()],
    ['En Production', stats.enProduction.toString()],
    ['En Déploiement', stats.enDeploiement.toString()],
    ['CA Réalisé', `${Math.round(stats.caRealise / 1000)}k€`],
    ['CA Prévisionnel', `${Math.round(stats.caPrevisionnel / 1000)}k€`],
    ['Taux de Conversion', `${stats.tauxConversion}%`],
    ['Progression Moyenne', `${stats.progressionMoyenne}%`]
  ]

  autoTable(doc, {
    startY: yPos,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
    tableWidth: (pageWidth - 28) / 2
  })

  // Market context table (right side)
  const marketData = [
    ['Contexte National', 'Valeur'],
    ['Part de marché actuelle', `${stats.partMarcheActuelle.toFixed(2)}%`],
    ['Part de marché potentielle', `${stats.partMarchePotentielle.toFixed(2)}%`],
    ['Passages en production', stats.passagesProduction.toLocaleString('fr-FR')],
    ['Passages pipeline total', stats.totalPassages.toLocaleString('fr-FR')],
    ['Passages restants', stats.passagesRestants.toLocaleString('fr-FR')],
    ['Potentiel CA restant', `${Math.round(stats.potentielMarcheRestant / 1000)}k€`],
  ]

  autoTable(doc, {
    startY: yPos,
    head: [marketData[0]],
    body: marketData.slice(1),
    theme: 'grid',
    headStyles: { fillColor: [34, 197, 94] },
    margin: { left: pageWidth / 2 + 7, right: 14 },
    tableWidth: (pageWidth - 28) / 2
  })

  // New page for details
  doc.addPage()
  doc.setFontSize(14)
  doc.text('Détails des Établissements', 14, 15)

  const tableData = data.map(etab => [
    etab.nom,
    etab.region || '-',
    etab.statut,
    etab.commercial || '-',
    etab.pallier_vise || '-',
    (etab.nombre_passages_urgences_annuel || 0).toLocaleString('fr-FR'),
    `${etab.progression || 0}%`,
    `${Math.round(etab.valeur / 1000)}k€`
  ])

  autoTable(doc, {
    startY: 25,
    head: [['Nom', 'Région', 'Statut', 'Commercial', 'Pallier', 'Passages', 'Prog.', 'Valeur']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 }
  })

  // By Region analysis
  doc.addPage()
  doc.setFontSize(14)
  doc.text('Analyse par Région', 14, 15)

  const byRegion = data.reduce<Record<string, RegionAggregate>>((acc, etab) => {
    const region = etab.region || 'Non défini'
    if (!acc[region]) {
      acc[region] = { region, count: 0, valeur: 0, enProduction: 0 }
    }
    acc[region].count++
    acc[region].valeur += etab.valeur
    if (etab.statut === 'Production' || etab.statut === 'Go-Live') {
      acc[region].enProduction++
    }
    return acc
  }, {})

  const regionTableData = Object.values(byRegion)
    .sort((a, b) => b.valeur - a.valeur)
    .map((r) => [
      r.region,
      r.count.toString(),
      r.enProduction.toString(),
      `${Math.round(r.valeur / 1000)}k€`,
      `${Math.round(r.valeur / r.count / 1000)}k€`
    ])


  autoTable(doc, {
    startY: 25,
    head: [['Région', 'Total', 'En Prod.', 'CA Total', 'CA Moyen']],
    body: regionTableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 }
  })

  // Save
  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EtabExportInput = any;
type ProfileExportInput = { id: string; prenom?: string | null; nom?: string | null };

export function prepareEtablissementsForExport(
  etablissements: EtabExportInput[],
  profiles: ProfileExportInput[]
): EtablissementExportData[] {
  return etablissements.map(etab => {
    // Calculate value
    const valeur = calculateEtablissementValue(etab)

    // Get profile names
    const commercial = profiles.find(p => p.id === etab.commercial_id)
    const csm = profiles.find(p => p.id === etab.csm_id)
    const chefProjet = profiles.find(p => p.id === etab.chef_projet_id)

    return {
      id: etab.id,
      nom: etab.nom,
      ville: etab.ville,
      region: etab.region,
      type: etab.type,
      statut: etab.statut,
      commercial: commercial ? `${commercial.prenom} ${commercial.nom}` : undefined,
      csm: csm ? `${csm.prenom} ${csm.nom}` : undefined,
      chef_projet: chefProjet ? `${chefProjet.prenom} ${chefProjet.nom}` : undefined,
      type_offre: etab.type_offre,
      pallier_vise: etab.pallier_vise,
      nombre_passages_urgences_annuel: etab.nombre_passages_urgences_annuel,
      progression: etab.progression,
      date_signature: etab.date_signature,
      date_fin_contrat: etab.date_fin_contrat,
      created_at: etab.created_at,
      valeur
    }
  })
}
