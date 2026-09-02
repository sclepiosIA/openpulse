import { Groupe } from "@/hooks/crm/useGroupes"
import { loadPdfLibs, loadExcelLibs } from "@/lib/export/dynamicPdfImport"

export function exportGroupesToCSV(groupes: Groupe[]) {
  const headers = [
    'Nom',
    'Type',
    'Région',
    'Ville siège',
    'Établissements',
    'Progression moyenne',
    'Passages urgences/an',
    'Modules déployés',
    'Email',
    'Téléphone',
    'Date création'
  ]

  const rows = groupes.map(g => [
    g.nom,
    g.type,
    g.region || '',
    g.ville_siege || '',
    g.nombre_etablissements,
    `${g.progression_moyenne.toFixed(1)}%`,
    g.total_passages_urgences_annuel || 0,
    (g.modules_deployes || []).join(', '),
    g.email || '',
    g.telephone || '',
    new Date(g.created_at).toLocaleDateString('fr-FR')
  ])

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `groupes_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

export async function exportGroupesToExcel(groupes: Groupe[]) {
  const { XLSX } = await loadExcelLibs()

  // Feuille 1: Liste des groupes
  const groupesData = groupes.map(g => ({
    'Nom': g.nom,
    'Type': g.type,
    'Région': g.region || '',
    'Ville siège': g.ville_siege || '',
    'Établissements': g.nombre_etablissements,
    'Progression moyenne': `${g.progression_moyenne.toFixed(1)}%`,
    'Passages urgences/an': g.total_passages_urgences_annuel || 0,
    'Modules déployés': (g.modules_deployes || []).join(', '),
    'Email': g.email || '',
    'Téléphone': g.telephone || '',
    'Date création': new Date(g.created_at).toLocaleDateString('fr-FR')
  }))

  // Feuille 2: Statistiques
  const statsData = [
    { 'Métrique': 'Total groupes', 'Valeur': groupes.length },
    { 'Métrique': 'Total établissements', 'Valeur': groupes.reduce((sum, g) => sum + g.nombre_etablissements, 0) },
    { 'Métrique': 'Progression moyenne', 'Valeur': `${(groupes.reduce((sum, g) => sum + g.progression_moyenne, 0) / groupes.length).toFixed(1)}%` },
    { 'Métrique': 'Total passages urgences/an', 'Valeur': groupes.reduce((sum, g) => sum + (g.total_passages_urgences_annuel || 0), 0) }
  ]

  // Feuille 3: Répartition par type
  const typeStats = groupes.reduce((acc, g) => {
    acc[g.type] = (acc[g.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const typeData = Object.entries(typeStats).map(([type, count]) => ({
    'Type': type,
    'Nombre': count,
    'Pourcentage': `${((count / groupes.length) * 100).toFixed(1)}%`
  }))

  // Feuille 4: Répartition par région
  const regionStats = groupes.reduce((acc, g) => {
    if (g.region) {
      acc[g.region] = (acc[g.region] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  const regionData = Object.entries(regionStats)
    .sort(([, a], [, b]) => b - a)
    .map(([region, count]) => ({
      'Région': region,
      'Nombre': count,
      'Pourcentage': `${((count / groupes.length) * 100).toFixed(1)}%`
    }))

  // Créer le workbook
  const wb = XLSX.utils.book_new()
  
  const ws1 = XLSX.utils.json_to_sheet(groupesData)
  XLSX.utils.book_append_sheet(wb, ws1, 'Groupes')
  
  const ws2 = XLSX.utils.json_to_sheet(statsData)
  XLSX.utils.book_append_sheet(wb, ws2, 'Statistiques')
  
  const ws3 = XLSX.utils.json_to_sheet(typeData)
  XLSX.utils.book_append_sheet(wb, ws3, 'Par type')
  
  const ws4 = XLSX.utils.json_to_sheet(regionData)
  XLSX.utils.book_append_sheet(wb, ws4, 'Par région')

  // Télécharger
  XLSX.writeFile(wb, `groupes_${new Date().toISOString().split('T')[0]}.xlsx`)
}

export async function exportGroupesToPDF(groupes: Groupe[]) {
  const { jsPDF, autoTable } = await loadPdfLibs()
  const doc = new jsPDF()
  
  // Titre
  doc.setFontSize(18)
  doc.text('Rapport des Groupes d\'Établissements', 14, 22)
  
  doc.setFontSize(11)
  doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 14, 30)
  doc.text(`Total groupes: ${groupes.length}`, 14, 36)

  // Statistiques globales
  const totalEtabs = groupes.reduce((sum, g) => sum + g.nombre_etablissements, 0)
  const progressionMoy = groupes.reduce((sum, g) => sum + g.progression_moyenne, 0) / groupes.length
  
  doc.setFontSize(14)
  doc.text('Statistiques globales', 14, 48)
  
  doc.setFontSize(10)
  doc.text(`Total établissements: ${totalEtabs}`, 14, 56)
  doc.text(`Progression moyenne: ${progressionMoy.toFixed(1)}%`, 14, 62)

  // Tableau des groupes
  const tableData = groupes.map(g => [
    g.nom,
    g.type,
    g.region || '-',
    g.nombre_etablissements.toString(),
    `${g.progression_moyenne.toFixed(1)}%`,
    (g.modules_deployes || []).slice(0, 2).join(', ') + ((g.modules_deployes?.length || 0) > 2 ? '...' : '')
  ])

  autoTable(doc, {
    startY: 72,
    head: [['Nom', 'Type', 'Région', 'Étab.', 'Prog.', 'Modules']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  // Sauvegarder
  doc.save(`groupes_${new Date().toISOString().split('T')[0]}.pdf`)
}
