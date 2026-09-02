import { RefObject } from 'react'
import { toast } from 'sonner'
import { debug } from '@/lib/debug'
import { isBefore } from 'date-fns'
import { generateGanttExportHeaderHTML } from '@/components/etablissement-gantt/export/GanttExportHeader'
import { generateGanttExportLegendHTML } from '@/components/etablissement-gantt/export/GanttExportLegend'
import { generateGanttExportFooterHTML } from '@/components/etablissement-gantt/export/GanttExportFooter'
import { loadPdfLibs, loadHtml2Canvas } from '@/lib/export/dynamicPdfImport'

interface GanttExportTask {
  statut?: string | null
  date_echeance?: string | null
}

interface GanttExportCategory {
  id: string
  nom: string
  couleur?: string | null
}

interface ExportContext {
  etablissementNom: string
  tasks: GanttExportTask[]
  categories: GanttExportCategory[]
  timeline: { start: Date; end: Date }
}

interface UseGanttExportReturn {
  exportToPNG: (containerRef: RefObject<HTMLElement>, context: ExportContext, filename?: string) => Promise<void>
  exportToPDF: (containerRef: RefObject<HTMLElement>, context: ExportContext, filename?: string) => Promise<void>
}

export function useGanttExport(): UseGanttExportReturn {
  const captureGantt = async (
    containerRef: RefObject<HTMLElement>,
    context: ExportContext
  ): Promise<HTMLCanvasElement> => {
    const { html2canvas } = await loadHtml2Canvas()
    
    if (!containerRef.current) {
      throw new Error('Aucun conteneur à capturer')
    }

    const container = containerRef.current
    
    // Créer un wrapper invisible dans le body
    const exportWrapper = document.createElement('div')
    exportWrapper.style.position = 'fixed'
    exportWrapper.style.left = '0'
    exportWrapper.style.top = '0'
    exportWrapper.style.zIndex = '-9999'
    exportWrapper.style.opacity = '0'
    exportWrapper.style.pointerEvents = 'none'
    exportWrapper.style.backgroundColor = '#ffffff'
    exportWrapper.style.overflow = 'visible'
    document.body.appendChild(exportWrapper)

    try {
      // Cloner le conteneur
      const cloned = container.cloneNode(true) as HTMLElement
      exportWrapper.appendChild(cloned)

      // Forcer l'utilisation de fonts système (non cross-origin) dans le clone
      cloned.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      
      const allClonedElements = cloned.querySelectorAll('*')
      allClonedElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        htmlEl.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      })

      // Supprimer les limitations de hauteur et scroll sur le clone
      cloned.style.overflow = 'visible'
      cloned.style.maxHeight = 'none'
      cloned.style.height = 'auto'

      // Trouver et modifier tous les éléments scrollables dans le clone
      const scrollables = cloned.querySelectorAll('.overflow-auto, .overflow-y-auto, .overflow-hidden, .overflow-x-auto')
      scrollables.forEach(el => {
        const htmlEl = el as HTMLElement
        htmlEl.style.overflow = 'visible'
        htmlEl.style.maxHeight = 'none'
        htmlEl.style.height = 'auto'
      })

      // Trouver et modifier la Card parent qui limite la hauteur
      const cards = cloned.querySelectorAll('[class*="max-h-"]')
      cards.forEach(el => {
        const htmlEl = el as HTMLElement
        htmlEl.style.maxHeight = 'none'
        htmlEl.style.height = 'auto'
      })

      // Désactiver temporairement le truncate sur le clone uniquement
      const truncatedElements = cloned.querySelectorAll('.truncate')
      truncatedElements.forEach(el => {
        el.classList.add('export-temp-no-truncate')
        el.classList.remove('truncate')
      })

      // Optimiser les couleurs pour l'export (renforcer les contrastes)
      cloned.style.backgroundColor = '#ffffff'
      
      // Calculer les statistiques
      const stats = {
        total: context.tasks.length,
        parStatut: {
          'A faire': context.tasks.filter((t) => t.statut === 'A faire').length,
          'En cours': context.tasks.filter((t) => t.statut === 'En cours').length,
          'Bloqué': context.tasks.filter((t) => t.statut === 'Bloqué').length,
          'Terminé': context.tasks.filter((t) => t.statut === 'Terminé').length,
        },
        enRetard: context.tasks.filter((t) =>
          t.date_echeance && isBefore(new Date(t.date_echeance), new Date()) && t.statut !== 'Terminé'
        ).length
      }

      // Générer et injecter le HTML statique pour le header
      const headerContainer = document.createElement('div')
      headerContainer.innerHTML = generateGanttExportHeaderHTML({
        etablissementNom: context.etablissementNom,
        dateDebut: context.timeline.start,
        dateFin: context.timeline.end,
        dateExport: new Date()
      })
      cloned.insertBefore(headerContainer, cloned.firstChild)

      // Générer et injecter le HTML statique pour la légende
      const legendContainer = document.createElement('div')
      legendContainer.innerHTML = generateGanttExportLegendHTML({
        categories: context.categories.map((c) => ({
          id: c.id,
          nom: c.nom,
          couleur: c.couleur ?? null,
        })),
        stats: stats
      })

      cloned.appendChild(legendContainer)

      // Générer et injecter le HTML statique pour le footer
      const footerContainer = document.createElement('div')
      footerContainer.innerHTML = generateGanttExportFooterHTML({})
      cloned.appendChild(footerContainer)

      // Forcer un reflow pour que le navigateur calcule les nouvelles dimensions
      void cloned.offsetHeight

      // Récupérer les dimensions réelles du clone
      const rect = cloned.getBoundingClientRect()

      // Capturer avec html2canvas
      const canvas = await html2canvas(cloned, {
        scale: 3,
        allowTaint: false,
        useCORS: true,
        foreignObjectRendering: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: rect.width,
        height: rect.height,
        windowWidth: rect.width,
        windowHeight: rect.height,
        ignoreElements: (element: Element) => {
          // Ignorer les tooltips, popovers et autres éléments flottants
          if (element.classList.contains('tooltip') || 
              element.classList.contains('popover') ||
              element.getAttribute('role') === 'tooltip' ||
              element.getAttribute('data-radix-popper-content-wrapper') !== null) {
            return true
          }
          
          // Ignorer tous les iframes (souvent cross-origin)
          if (element.tagName === 'IFRAME') {
            return true
          }
          
          // Ignorer les images cross-origin
          if (element.tagName === 'IMG') {
            const img = element as HTMLImageElement
            if (img.src) {
              try {
                const imgOrigin = new URL(img.src).origin
                if (imgOrigin !== window.location.origin) {
                  return true
                }
              } catch (e) {
                // URL invalide, ignorer par sécurité
                return true
              }
            }
          }
          
          return false
        }
      })

      // Canvas size validation (dev mode only)
      if (import.meta.env.DEV) {
        console.debug('[GanttExport] Canvas size:', canvas.width, 'x', canvas.height)
      }
      if (canvas.width === 0 || canvas.height === 0) {
        debug.warn('[GanttExport] Empty canvas returned from html2canvas')
      }

      return canvas
    } finally {
      // Nettoyer le wrapper invisible
      document.body.removeChild(exportWrapper)
    }
  }

  const exportToPNG = async (
    containerRef: RefObject<HTMLElement>,
    context: ExportContext,
    filename: string = 'planning-gantt.png'
  ): Promise<void> => {
    try {
      toast.info('Génération de l\'image en cours...', { id: 'export-png' })
      
      const canvas = await captureGantt(containerRef, context)
      
      canvas.toBlob((blob) => {
        if (!blob) {
          debug.error('❌ Erreur export PNG: canvas.toBlob a retourné null', {
            width: canvas.width,
            height: canvas.height,
            message: 'Canvas potentiellement "tainted" par du contenu cross-origin'
          })
          toast.error("Impossible de créer l'image PNG. Vérifiez que toutes les ressources sont accessibles.", { id: 'export-png' })
          return
        }

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success('Export PNG réussi', { id: 'export-png' })
      }, 'image/png')
    } catch (error) {
      debug.error('Erreur lors de l\'export PNG:', error)
      toast.error('Impossible d\'exporter le Gantt en PNG', { id: 'export-png' })
    }
  }

  const exportToPDF = async (
    containerRef: RefObject<HTMLElement>,
    context: ExportContext,
    filename: string = 'planning-gantt.pdf'
  ): Promise<void> => {
    try {
      toast.info('Génération du PDF en cours...', { id: 'export-pdf' })
      
      const canvas = await captureGantt(containerRef, context)
      
      const { jsPDF } = await loadPdfLibs()
      
      // Format A3 paysage
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a3'
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const margin = 20 // Marges augmentées pour un rendu plus aéré

      const contentWidth = pdfWidth - (2 * margin)
      const contentHeight = pdfHeight - (2 * margin) - 15 // Espace pour le footer

      // Calculer le ratio pour ajuster l'image
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(contentWidth / imgWidth, contentHeight / imgHeight)

      const scaledWidth = imgWidth * ratio
      const scaledHeight = imgHeight * ratio

      // Si l'image est plus grande qu'une page, on doit la diviser
      const totalPages = Math.ceil(scaledHeight / contentHeight)

      for (let page = 1; page <= totalPages; page++) {
        if (page > 1) {
          pdf.addPage('a3', 'landscape')
        }

        const sourceY = (page - 1) * (contentHeight / ratio)
        const sourceHeight = Math.min(contentHeight / ratio, imgHeight - sourceY)

        // Créer un canvas temporaire pour cette portion
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = imgWidth
        tempCanvas.height = sourceHeight
        const tempCtx = tempCanvas.getContext('2d')

        if (tempCtx) {
          tempCtx.drawImage(
            canvas,
            0, sourceY,
            imgWidth, sourceHeight,
            0, 0,
            imgWidth, sourceHeight
          )

          const imgData = tempCanvas.toDataURL('image/png')
          const pageHeight = sourceHeight * ratio

          pdf.addImage(
            imgData,
            'PNG',
            margin,
            margin,
            scaledWidth,
            pageHeight
          )
        }

        // Ajouter le numéro de page dans le footer
        pdf.setFontSize(9)
        pdf.setTextColor(108, 117, 125)
        pdf.text(
          `Page ${page} / ${totalPages}`,
          pdfWidth - margin - 20,
          pdfHeight - margin + 10
        )
      }

      pdf.save(filename)
      toast.success('Export PDF réussi', { id: 'export-pdf' })
    } catch (error) {
      debug.error('Erreur lors de l\'export PDF:', error)
      toast.error('Impossible d\'exporter le Gantt en PDF', { id: 'export-pdf' })
    }
  }

  return {
    exportToPNG,
    exportToPDF,
  }
}
