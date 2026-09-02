// Import statique du logo pour les PDFs (ne fonctionne pas avec import
// dynamique après build Vite).
//
// Le même fichier était importé trois fois sous trois noms différents, dont
// deux hérités de la marque d'origine, dont l'emblème était une croix
// carrée. L'un des trois ne servait plus. Un seul nom, une seule image.
import marqueLogoIA from '@/assets/marque/logo.png'
import { MARQUE } from '@/config/branding'

/** Configuration du footer/signataire pour les exports PDF */
export interface PdfFooterConfig {
  signataire_nom?: string
  signataire_titre?: string
  company_name?: string
  email?: string
}

/**
 * Repli du pied de page des documents.
 *
 * Il ne contient plus de nom en dur : ces valeurs partaient sur les factures et
 * les feuilles d'émargement de chaque adoptant, sous une identité qui n'était
 * pas la sienne. Elles viennent maintenant de l'identité de construction
 * (`MARQUE`), elle-même surchargeable par l'administrateur via `app_config`.
 *
 * Le signataire n'a AUCUN repli : deviner un nom sur un document signé serait
 * pire que de laisser la ligne vide. Les appelants qui produisent un document
 * signé passent `footerConfig` ; ceux qui n'en passent pas obtiennent un
 * document sans signataire, ce qui se voit.
 */
const DEFAULT_FOOTER: Required<PdfFooterConfig> = {
  signataire_nom: '',
  signataire_titre: '',
  company_name: MARQUE.nomProduit,
  email: MARQUE.contacts.general,
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) return

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          if (value === null || value === undefined) return ''
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`
          }
          return value
        })
        .join(',')
    ),
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

interface EtablissementForExport {
  nom: string
  ville?: string | null
  region?: string | null
  type?: string | null
  statut?: string | null
  nombre_passages_urgences_annuel?: number | null
  dpi?: string | null
  date_signature?: string | null
  progression?: number | null
}

export function prepareEtablissementsForExport(etablissements: EtablissementForExport[]) {
  return etablissements.map((etab) => ({
    Nom: etab.nom,
    Ville: etab.ville,
    Région: etab.region,
    Type: etab.type,
    Statut: etab.statut,
    'Passages Urgences': etab.nombre_passages_urgences_annuel || 0,
    DPI: etab.dpi || '',
    'Date Signature': etab.date_signature || '',
    Progression: etab.progression || 0,
  }))
}

interface UserFormationForExport {
  nom: string
  prenom: string
  email: string
  telephone?: string | null
  fonction: string
  service?: string | null
  specialite?: string | null
  statut_formation: string
  nombre_sessions_suivies?: number | null
  date_premiere_formation?: string | null
  date_derniere_formation?: string | null
  derniere_utilisation?: string | null
  nombre_connexions?: number | null
  actif?: boolean | null
}

function formatStatutFormation(statut: string): string {
  const statutMap: Record<string, string> = {
    non_forme: 'Non formé',
    en_cours: 'En cours',
    forme: 'Formé',
    a_rafraichir: 'À rafraîchir',
  }
  return statutMap[statut] || statut
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR')
  } catch {
    return dateStr
  }
}

export function prepareUsersFormationForExport(users: UserFormationForExport[]) {
  return users.map((user) => ({
    Nom: user.nom,
    Prénom: user.prenom,
    Email: user.email,
    Téléphone: user.telephone || '',
    Fonction: user.fonction,
    Service: user.service || '',
    Spécialité: user.specialite || '',
    'Statut Formation': formatStatutFormation(user.statut_formation),
    'Sessions Suivies': user.nombre_sessions_suivies || 0,
    'Date Première Formation': formatDate(user.date_premiere_formation),
    'Date Dernière Formation': formatDate(user.date_derniere_formation),
    'Dernière Connexion': formatDate(user.derniere_utilisation),
    'Nombre Connexions': user.nombre_connexions || 0,
    Actif: user.actif ? 'Oui' : 'Non',
  }))
}

export async function exportUsersFormationToPDF(
  users: UserFormationForExport[],
  etablissementName?: string,
  footerConfig?: PdfFooterConfig
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()
  const primaryBlue: [number, number, number] = [25, 82, 148]
  const accentOrange: [number, number, number] = [230, 126, 34]

  // Bandeau bleu en haut
  doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
  doc.rect(0, 0, 210, 28, 'F')

  // Logo croix compact à gauche
  // Le logo était posé dans un carré de 20 × 20 alors qu'il mesure
  // 1920 × 447 : il sortait écrasé sur chaque document exporté. La hauteur
  // est conservée, la largeur suit le rapport réel de l'image.
  doc.addImage(marqueLogoIA, 'PNG', 10, 4, 20 * (1920 / 447), 20)

  // Texte "OpenPulse" à côté du logo
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('OpenPulse', 32, 12)

  // Slogan en petit
  doc.setFontSize(6)
  doc.setFont('helvetica', 'italic')
  doc.text('Créé par des hospitaliers pour les hospitaliers', 32, 17)

  // Titre centré dans la partie droite du bandeau (évite chevauchement)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('RAPPORT DES PERSONNES FORMÉES', 140, 14, { align: 'center' })

  // Ligne orange décorative
  doc.setDrawColor(accentOrange[0], accentOrange[1], accentOrange[2])
  doc.setLineWidth(1.5)
  doc.line(14, 32, 196, 32)

  // Métadonnées avec labels en bleu
  let yPos = 42
  doc.setFontSize(11)

  // Date
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
  doc.setFont('helvetica', 'bold')
  doc.text('Date :', 14, yPos)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text(new Date().toLocaleDateString('fr-FR'), 32, yPos)
  yPos += 7

  // Établissement
  if (etablissementName) {
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
    doc.setFont('helvetica', 'bold')
    doc.text('Établissement :', 14, yPos)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.text(etablissementName, 50, yPos)
    yPos += 7
  }

  // Total utilisateurs
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
  doc.setFont('helvetica', 'bold')
  doc.text('Total utilisateurs :', 14, yPos)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text(users.length.toString(), 55, yPos)
  yPos += 10

  // Statistiques par statut
  const stats = {
    forme: users.filter((u) => u.statut_formation === 'forme').length,
    en_cours: users.filter((u) => u.statut_formation === 'en_cours').length,
    non_forme: users.filter((u) => u.statut_formation === 'non_forme').length,
    a_rafraichir: users.filter((u) => u.statut_formation === 'a_rafraichir').length,
  }

  doc.setFontSize(10)
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
  doc.setFont('helvetica', 'bold')
  doc.text('Statistiques :', 14, yPos)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Formés: ${stats.forme} | En cours: ${stats.en_cours} | Non formés: ${stats.non_forme} | À rafraîchir: ${stats.a_rafraichir}`,
    42,
    yPos
  )
  yPos += 7

  // Taux de formation
  const tauxFormation = users.length > 0 ? ((stats.forme / users.length) * 100).toFixed(1) : '0'
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
  doc.setFont('helvetica', 'bold')
  doc.text('Taux de formation :', 14, yPos)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text(`${tauxFormation}%`, 55, yPos)
  yPos += 12

  // Tableau des utilisateurs
  const tableData = users.map((u) => [
    u.nom,
    u.prenom,
    u.email,
    u.fonction,
    formatStatutFormation(u.statut_formation),
    (u.nombre_sessions_suivies || 0).toString(),
    formatDate(u.date_derniere_formation),
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Nom', 'Prénom', 'Email', 'Fonction', 'Statut', 'Sessions', 'Dernière formation']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [primaryBlue[0], primaryBlue[1], primaryBlue[2]] },
    columnStyles: {
      2: { cellWidth: 45 },
    },
  })

  // Footer de validation officielle
  const finalY = (doc.lastAutoTable as { finalY?: number } | undefined)?.finalY ?? 200
  const footerY = Math.min(finalY + 20, 270)
  const fc = { ...DEFAULT_FOOTER, ...footerConfig }

  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`Validé conforme par ${fc.signataire_nom}`, 105, footerY, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(fc.signataire_titre, 105, footerY + 6, { align: 'center' })

  // Sauvegarder
  const filename = etablissementName
    ? `personnes-formees-${etablissementName.toLowerCase().replace(/\s+/g, '-')}.pdf`
    : `personnes-formees-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

interface SessionForEmargementExport {
  titre: string
  date_debut: string
  duree_heures: number
  lieu?: string | null
  modalite?: string | null
  type_formation: string
  formateur_nom?: string | null
  formateur_prenom?: string | null
}

interface EtablissementForEmargementExport {
  nom: string
  ville?: string | null
}

export interface EmargementForExport {
  etablissement_users: {
    nom: string
    prenom: string
    fonction?: string | null
    service?: string | null
  } | null
  present: boolean
  signature_type: string
  date_emargement?: string | null
}

function formatTypeFormation(type: string): string {
  const typeMap: Record<string, string> = {
    initiale: 'Initiale',
    perfectionnement: 'Perfectionnement',
    rappel: 'Rappel',
    accompagnement: 'Accompagnement',
  }
  return typeMap[type] || type
}

function formatModalite(modalite: string | null | undefined): string {
  if (!modalite) return 'Non définie'
  const modaliteMap: Record<string, string> = {
    presentiel: 'Présentiel',
    distanciel: 'Distanciel',
    hybride: 'Hybride',
  }
  return modaliteMap[modalite] || modalite
}

export function exportFeuilleEmargementPDF(
  session: SessionForEmargementExport,
  etablissement: EtablissementForEmargementExport,
  emargements: EmargementForExport[],
  footerConfig?: PdfFooterConfig
) {
  import('jspdf').then(({ default: jsPDF }) => {
    import('jspdf-autotable').then(async ({ default: autoTable }) => {
      const doc = new jsPDF()

      // Couleurs OpenPulse
      const primaryBlue: [number, number, number] = [30, 74, 122]
      const orange: [number, number, number] = [245, 166, 35]

      // ===== EN-TÊTE AVEC BANDEAU BLEU =====
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.rect(0, 0, 210, 28, 'F')

      // Charger et ajouter le logo OpenPulse (import statique)
      const img = new Image()
      img.src = marqueLogoIA
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve() // Continue même si erreur
      })

      // Logo à gauche du bandeau
      const logoHeight = 18
      const logoWidth = (img.naturalWidth / img.naturalHeight) * logoHeight || 45
      doc.addImage(marqueLogoIA, 'PNG', 12, 5, logoWidth, logoHeight)

      // Titre "FEUILLE D'ÉMARGEMENT" en blanc centré
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text("FEUILLE D'ÉMARGEMENT", 125, 17, { align: 'center' })

      // Ligne orange décorative
      doc.setFillColor(orange[0], orange[1], orange[2])
      doc.rect(0, 28, 210, 3, 'F')

      // ===== NOM DE L'ÉTABLISSEMENT =====
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      const etablissementText = etablissement.ville
        ? `${etablissement.nom} - ${etablissement.ville}`
        : etablissement.nom
      doc.text(etablissementText, 105, 40, { align: 'center' })

      // ===== CADRE D'INFORMATIONS SESSION =====
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(14, 46, 182, 38, 2, 2, 'FD')

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.text('Formation :', 18, 54)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(session.titre, 44, 54)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.text('Type :', 18, 61)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(formatTypeFormation(session.type_formation), 32, 61)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.text('Modalité :', 70, 61)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(formatModalite(session.modalite), 92, 61)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.text('Date :', 130, 61)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      const dateFormatted = new Date(session.date_debut).toLocaleString('fr-FR', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
      doc.text(dateFormatted, 143, 61)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.text('Durée :', 18, 68)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(`${session.duree_heures} heure(s)`, 35, 68)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.text('Lieu :', 70, 68)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(session.lieu || 'Non précisé', 82, 68)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.text('Formateur(s) :', 18, 78)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      const formateurText =
        session.formateur_nom && session.formateur_prenom
          ? `${session.formateur_prenom} ${session.formateur_nom}`
          : 'Non défini'
      doc.text(formateurText, 50, 78)

      // ===== TABLEAU DES PARTICIPANTS =====
      const tableData = emargements.map((e, index) => {
        const user = e.etablissement_users
        return [
          (index + 1).toString(),
          user?.nom?.toUpperCase() || 'N/A',
          user?.prenom || 'N/A',
          user?.fonction || '-',
          user?.service || '-',
          e.present ? '☑' : '☐',
          e.present && e.signature_type !== 'manuel' ? 'Signé num.' : '',
        ]
      })

      autoTable(doc, {
        startY: 88,
        head: [['N°', 'Nom', 'Prénom', 'Fonction', 'Service', 'Présent', 'Signature']],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: [primaryBlue[0], primaryBlue[1], primaryBlue[2]],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 30 },
          3: { cellWidth: 35 },
          4: { cellWidth: 25 },
          5: { cellWidth: 18, halign: 'center' },
          6: { cellWidth: 30 },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      })

      // ===== STATISTIQUES =====
      const finalY = doc.lastAutoTable?.finalY || 88
      const totalPresents = emargements.filter((e) => e.present).length

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(`Total présents : ${totalPresents} / ${emargements.length}`, 14, finalY + 10)

      // ===== LIGNE DE SÉPARATION =====
      doc.setDrawColor(200, 200, 200)
      doc.line(14, finalY + 18, 196, finalY + 18)

      // ===== VALIDATION OFFICIELLE =====
      const fc = { ...DEFAULT_FOOTER, ...footerConfig }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.text(`Validé conforme par ${fc.signataire_nom}`, 105, finalY + 28, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text(fc.signataire_titre, 105, finalY + 35, { align: 'center' })

      // ===== DATE DE GÉNÉRATION =====
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')}`, 105, 290, {
        align: 'center',
      })

      // Sauvegarder
      const sessionDate = new Date(session.date_debut).toISOString().split('T')[0]
      const sanitizedTitle = session.titre
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .substring(0, 30)
      const filename = `feuille-emargement-${sanitizedTitle}-${sessionDate}.pdf`
      doc.save(filename)
    })
  })
}
