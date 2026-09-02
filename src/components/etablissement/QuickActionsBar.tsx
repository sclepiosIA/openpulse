import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Edit, Share2, FileDown, MoreVertical, Archive, Copy } from 'lucide-react'
import { useToast } from '@/hooks/shared/use-toast'
import { ManualWorkflowTrigger } from '@/components/automatisations/ManualWorkflowTrigger'
import { EnrichProspectButton } from '@/components/etablissement/EnrichProspectButton'

interface QuickActionsBarProps {
  onEdit: () => void
  etablissementNom: string
  etablissementId?: string
  enrichmentStatus?: string | null
  enrichmentAt?: string | null
}

export function QuickActionsBar({
  onEdit,
  etablissementNom,
  etablissementId,
  enrichmentStatus,
  enrichmentAt,
}: QuickActionsBarProps) {
  const { toast } = useToast()

  const handleExport = (format: 'pdf' | 'csv') => {
    toast({
      title: 'Export en cours',
      description: `Export ${format.toUpperCase()} de ${etablissementNom}`,
    })
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({
      title: 'Lien copié',
      description: 'Le lien a été copié dans le presse-papiers',
    })
  }

  return (
    <div className="flex items-center gap-2">
      {etablissementId && (
        <EnrichProspectButton
          etablissementId={etablissementId}
          enrichmentStatus={enrichmentStatus}
          enrichmentAt={enrichmentAt}
          variant="ghost"
          size="sm"
        />
      )}
      {etablissementId && (
        <ManualWorkflowTrigger
          payload={{ etablissement_id: etablissementId, etablissement_nom: etablissementNom }}
          variant="ghost"
          size="sm"
          label=""
        />
      )}
      <Button
        onClick={onEdit}
        size="sm"
        aria-label="Modifier"
        className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
        title="Modifier"
      >
        <Edit className="w-4 h-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Plus d'options"
            title="Plus d'options"
            className="h-9 w-9 rounded-xl hover:bg-primary/10 transition-all"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="z-50 rounded-xl border border-border shadow-lg bg-popover w-48"
        >
          <DropdownMenuItem onClick={() => handleExport('pdf')} className="rounded-lg">
            <FileDown className="w-4 h-4 mr-2" />
            Exporter en PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('csv')} className="rounded-lg">
            <FileDown className="w-4 h-4 mr-2" />
            Exporter en CSV
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleShare} className="rounded-lg">
            <Share2 className="w-4 h-4 mr-2" />
            Partager le lien
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="rounded-lg">
            <Archive className="w-4 h-4 mr-2" />
            Archiver
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-lg">
            <Copy className="w-4 h-4 mr-2" />
            Dupliquer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
