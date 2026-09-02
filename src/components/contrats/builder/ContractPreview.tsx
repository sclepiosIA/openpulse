import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContractSection } from '@/hooks/contracts/useContractSections'
import DOMPurify from 'dompurify'

interface ContractPreviewProps {
  sections: ContractSection[]
  titre: string
  highlightedSectionId?: string | null
}

export function ContractPreview({ sections, titre, highlightedSectionId }: ContractPreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Numérotation automatique des sections
  const renderSectionNumber = (indices: number[]): string => {
    return indices
      .map((i, idx) => {
        if (idx === 0) return String(i)
        return String(i)
      })
      .join('.')
  }

  const renderSection = (section: ContractSection, indices: number[] = [1]): React.ReactNode => {
    const sectionNumber = renderSectionNumber(indices)
    const isHighlighted = section.id === highlightedSectionId

    return (
      <div
        key={section.id}
        id={`preview-section-${section.id}`}
        className={cn(
          'mb-4 transition-colors',
          isHighlighted && 'bg-primary/5 border-l-2 border-primary pl-3 -ml-3'
        )}
      >
        {/* Section title */}
        <div
          className={cn(
            'font-semibold mb-2',
            indices.length === 1 && 'text-lg mt-6 first:mt-0 uppercase',
            indices.length === 2 && 'text-base mt-4',
            indices.length >= 3 && 'text-sm mt-3'
          )}
        >
          <span className="mr-2 text-muted-foreground">{sectionNumber}.</span>
          {section.titre}
        </div>

        {/* Section content */}
        {section.contenu_html && (
          <div
            className="text-sm leading-relaxed text-foreground/90"
            // safe: DOMPurify.sanitize applied inline before injection
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(section.contenu_html),
            }}
          />
        )}

        {/* Children */}
        {section.children?.map((child, idx) => renderSection(child, [...indices, idx + 1]))}
      </div>
    )
  }

  const escapeHtml = (s: string) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const handlePrint = () => {
    const printContent = contentRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const safeTitre = escapeHtml(titre)

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${safeTitre}</title>
          <style>
            body { 
              font-family: 'Times New Roman', Times, serif; 
              max-width: 800px; 
              margin: 0 auto; 
              padding: 40px;
              font-size: 12pt;
              line-height: 1.5;
            }
            h1 { 
              text-align: center; 
              font-size: 18pt; 
              margin-bottom: 30px;
              text-transform: uppercase;
            }
            .section-title { 
              font-weight: bold; 
              margin-top: 20px;
            }
            .section-number {
              color: #666;
              margin-right: 8px;
            }
            p { margin: 10px 0; text-align: justify; }
            ul, ol { margin-left: 20px; }
            @media print {
              body { margin: 0; padding: 20mm; }
            }
          </style>
        </head>
        <body>
          <h1>${safeTitre}</h1>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Aperçu
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            aria-label="Imprimer"
            title="Imprimer"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview content */}
      <ScrollArea className="flex-1">
        <div className="p-6 bg-card min-h-full" ref={contentRef}>
          {/* Document header */}
          <div className="text-center mb-8 pb-6 border-b">
            <h1 className="text-xl font-bold uppercase tracking-wide">{titre}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Entre les parties ci-dessous désignées
            </p>
          </div>

          {/* Sections */}
          {sections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Aucune section dans ce contrat.</p>
              <p className="text-xs mt-1">Ajoutez des sections dans le panneau de gauche.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sections.map((section, idx) => renderSection(section, [idx + 1]))}
            </div>
          )}

          {/* Footer placeholder */}
          <div className="mt-12 pt-6 border-t text-sm text-muted-foreground">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="font-semibold mb-4">Pour le Prestataire :</p>
                <div className="h-20 border-b border-dashed border-muted-foreground/30" />
                <p className="mt-2 text-xs">Signature et cachet</p>
              </div>
              <div>
                <p className="font-semibold mb-4">Pour le Client :</p>
                <div className="h-20 border-b border-dashed border-muted-foreground/30" />
                <p className="mt-2 text-xs">Signature et cachet</p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
