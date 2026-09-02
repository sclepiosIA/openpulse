import React, { useState, useEffect } from 'react'
import { debug } from '@/lib/debug'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { loadPdfLibs, loadExcelLibs, preloadExportLibs } from '@/lib/export/dynamicPdfImport'

interface TresorerieExportButtonsProps {
  revenus: any[]
  depenses: any[]
  qontoBalance: number
  moisCourant: string
  compact?: boolean
}

export function TresorerieExportButtons({
  revenus,
  depenses,
  qontoBalance,
  moisCourant,
  compact = false,
}: TresorerieExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false)

  // Preload libraries on mount for faster export
  useEffect(() => {
    preloadExportLibs()
  }, [])

  const formatMontant = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const { XLSX } = await loadExcelLibs()
      const workbook = XLSX.utils.book_new()

      // Feuille Revenus
      const revenusData = revenus.map((r) => ({
        Établissement: r.etablissements?.nom || 'N/A',
        Mois: r.mois,
        'Montant prévu': r.montant_prevu || 0,
        'Montant payé': r.montant_paye || 0,
        Statut: r.statut,
        'Date facture': r.date_facture || '',
        'Date paiement': r.date_paiement || '',
        'Référence facture': r.reference_facture || '',
      }))
      const revenusSheet = XLSX.utils.json_to_sheet(revenusData)
      XLSX.utils.book_append_sheet(workbook, revenusSheet, 'Revenus')

      // Feuille Dépenses
      const depensesData = depenses.map((d) => ({
        Libellé: d.nom || d.libelle || '',
        Catégorie: d.categorie_code || d.categorie_depense || d.categorie || '',
        Montant: d.montant,
        'Date prévue': d.date_prevue,
        Statut: d.statut,
        Fournisseur: d.fournisseur || '',
        Référence: d.reference || '',
      }))
      const depensesSheet = XLSX.utils.json_to_sheet(depensesData)
      XLSX.utils.book_append_sheet(workbook, depensesSheet, 'Dépenses')

      // Feuille Résumé
      const totalRevenus = revenus.reduce((s, r) => s + (r.montant_paye || r.montant_prevu || 0), 0)
      const totalDepenses = depenses.reduce((s, d) => s + d.montant, 0)
      const resumeData = [
        { Indicateur: 'Solde Qonto', Valeur: qontoBalance },
        { Indicateur: 'Total Revenus', Valeur: totalRevenus },
        { Indicateur: 'Total Dépenses', Valeur: totalDepenses },
        { Indicateur: 'Solde Calculé', Valeur: totalRevenus - totalDepenses },
        { Indicateur: 'Date export', Valeur: format(new Date(), 'dd/MM/yyyy HH:mm') },
      ]
      const resumeSheet = XLSX.utils.json_to_sheet(resumeData)
      XLSX.utils.book_append_sheet(workbook, resumeSheet, 'Résumé')

      // Télécharger
      const fileName = `tresorerie_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      XLSX.writeFile(workbook, fileName)
      toast.success('Export Excel généré avec succès')
    } catch (error) {
      debug.error('Erreur export Excel:', error)
      toast.error("Erreur lors de l'export Excel")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      const { jsPDF, autoTable } = await loadPdfLibs()
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      // Titre
      doc.setFontSize(20)
      doc.setTextColor(30, 64, 175)
      doc.text('Rapport Trésorerie', pageWidth / 2, 20, { align: 'center' })

      // Sous-titre
      doc.setFontSize(12)
      doc.setTextColor(100)
      doc.text(
        `Généré le ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}`,
        pageWidth / 2,
        28,
        { align: 'center' }
      )

      // KPIs
      const totalRevenus = revenus
        .filter((r) => r.statut === 'paye')
        .reduce((s, r) => s + (r.montant_paye || r.montant_prevu || 0), 0)
      const totalDepenses = depenses
        .filter((d) => d.statut === 'paye' || d.statut === 'payee')
        .reduce((s, d) => s + d.montant, 0)
      const aEncaisser = revenus
        .filter((r) => r.statut === 'facture')
        .reduce((s, r) => s + (r.montant_prevu || 0), 0)
      const aPayer = depenses
        .filter((d) => d.statut === 'en_attente')
        .reduce((s, d) => s + d.montant, 0)

      doc.setFontSize(14)
      doc.setTextColor(0)
      doc.text('Résumé financier', 14, 45)

      const kpisData = [
        ['Solde Qonto', formatMontant(qontoBalance)],
        ['Revenus encaissés', formatMontant(totalRevenus)],
        ['Dépenses payées', formatMontant(totalDepenses)],
        ['Solde calculé', formatMontant(totalRevenus - totalDepenses)],
        ['À encaisser', formatMontant(aEncaisser)],
        ['À payer', formatMontant(aPayer)],
      ]

      autoTable(doc, {
        head: [['Indicateur', 'Montant']],
        body: kpisData,
        startY: 50,
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 10 },
      })

      // Derniers revenus
      const lastRevenus = revenus
        .slice(0, 10)
        .map((r) => [
          r.etablissements?.nom || 'N/A',
          r.mois,
          formatMontant(r.montant_prevu || 0),
          r.statut,
        ])

      type DocWithAutoTable = typeof doc & { lastAutoTable: { finalY: number } }

      if (lastRevenus.length > 0) {
        doc.text('Derniers revenus', 14, (doc as DocWithAutoTable).lastAutoTable.finalY + 15)
        autoTable(doc, {
          head: [['Établissement', 'Mois', 'Montant', 'Statut']],
          body: lastRevenus,
          startY: (doc as DocWithAutoTable).lastAutoTable.finalY + 20,
          theme: 'striped',
          headStyles: { fillColor: [34, 197, 94] },
          styles: { fontSize: 9 },
        })
      }

      // Dernières dépenses
      const lastDepenses = depenses
        .slice(0, 10)
        .map((d) => [
          d.nom || d.libelle || '',
          d.categorie_code || d.categorie_depense || d.categorie || '',
          formatMontant(d.montant),
          d.statut,
        ])

      if (lastDepenses.length > 0) {
        doc.text('Dernières dépenses', 14, (doc as DocWithAutoTable).lastAutoTable.finalY + 15)
        autoTable(doc, {
          head: [['Libellé', 'Catégorie', 'Montant', 'Statut']],
          body: lastDepenses,
          startY: (doc as DocWithAutoTable).lastAutoTable.finalY + 20,
          theme: 'striped',
          headStyles: { fillColor: [239, 68, 68] },
          styles: { fontSize: 9 },
        })
      }

      // Pied de page
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(
          `Page ${i} sur ${pageCount} - OpenPulse`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        )
      }

      // Télécharger
      const fileName = `tresorerie_rapport_${format(new Date(), 'yyyy-MM-dd')}.pdf`
      doc.save(fileName)
      toast.success('Rapport PDF généré avec succès')
    } catch (error) {
      debug.error('Erreur export PDF:', error)
      toast.error("Erreur lors de l'export PDF")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={compact ? 'ghost' : 'outline'}
          size="sm"
          disabled={isExporting}
          className={
            compact
              ? 'h-8 w-8 p-0 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white rounded-lg'
              : ''
          }
        >
          {isExporting ? (
            <Loader2
              className={compact ? 'h-3.5 w-3.5 animate-spin' : 'h-4 w-4 mr-2 animate-spin'}
            />
          ) : (
            <Download className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4 mr-2'} />
          )}
          {!compact && 'Exporter'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background">
        <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
          Export Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2 text-red-600" />
          Rapport PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
