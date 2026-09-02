import { FileText, CheckCircle2, XCircle, AlertCircle, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BulletinUploadResult } from './bulkUploadBulletinsHelpers'

interface ProfileLite {
  id: string
  prenom?: string | null
  nom?: string | null
  email?: string | null
}

interface BulkUploadBulletinsResultRowProps {
  result: BulletinUploadResult
  index: number
  profilesMap: Map<string, ProfileLite>
  isProcessing: boolean
  onManualProfileChange: (index: number, profileId: string) => void
  onManualAssociate: (index: number) => void
}

export function BulkUploadBulletinsResultRow({
  result,
  index,
  profilesMap,
  isProcessing,
  onManualProfileChange,
  onManualAssociate,
}: BulkUploadBulletinsResultRowProps) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
      <div className="flex-shrink-0">
        {result.status === 'pending' && (
          <FileText className="h-5 w-5 text-muted-foreground" />
        )}
        {result.status === 'analyzing' && (
          <AlertCircle className="h-5 w-5 text-blue-500 animate-pulse" />
        )}
        {result.status === 'uploading' && (
          <Upload className="h-5 w-5 text-blue-500 animate-pulse" />
        )}
        {result.status === 'success' && (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        )}
        {result.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{result.fileName}</p>
        {result.status === 'success' && result.employeeName && (
          <p className="text-xs text-muted-foreground">
            {result.employeeName} • {result.mois}
            {result.matchType === 'partial' && ' (correspondance partielle)'}
            {result.matchType === 'manual' && ' (association manuelle)'}
          </p>
        )}
        {result.status === 'error' && result.error && (
          <>
            <p className="text-xs text-red-500">{result.error}</p>
            {result.canAssociateManually && profilesMap.size > 0 && !isProcessing && (
              <>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Associez manuellement ce bulletin à un employé
                </p>
                <div className="mt-2 space-y-2">
                  <Select
                    value={result.manualProfileId || ''}
                    onValueChange={(value) => onManualProfileChange(index, value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choisir un employé" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(profilesMap.values()).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.prenom} {p.nom} ({p.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onManualAssociate(index)}
                    disabled={!result.manualProfileId}
                    className="w-full text-xs"
                  >
                    Associer manuellement
                  </Button>
                </div>
              </>
            )}
          </>
        )}
        {result.status === 'analyzing' && (
          <p className="text-xs text-blue-500">Analyse GPT en cours...</p>
        )}
        {result.status === 'uploading' && (
          <p className="text-xs text-blue-500">Upload et création du salaire...</p>
        )}
      </div>
      {result.status === 'success' && result.matchType && (
        <Badge
          variant={
            result.matchType === 'exact' || result.matchType === 'manual'
              ? 'default'
              : 'secondary'
          }
        >
          {result.matchType === 'exact'
            ? 'Exact'
            : result.matchType === 'manual'
              ? 'Manuel'
              : 'Partiel'}
        </Badge>
      )}
    </div>
  )
}
