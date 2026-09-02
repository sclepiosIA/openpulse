import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, AlertCircle } from 'lucide-react'
import { parseProduitsCSV, useProduitImport, type ParsedProduitRow } from '@/hooks/catalogue/useProduitImport'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
}

export function CatalogueImportDialog({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<ParsedProduitRow[]>([])
  const [fileName, setFileName] = useState<string>('')
  const { importRows, isImporting } = useProduitImport()

  const handleFile = async (file: File) => {
    setFileName(file.name)
    const text = await file.text()
    setRows(parseProduitsCSV(text))
  }

  const valid = rows.filter((r) => !r._errors).length
  const invalid = rows.length - valid

  const handleImport = async () => {
    const res = await importRows(rows)
    if (res.inserted > 0) {
      onOpenChange(false)
      setRows([])
      setFileName('')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setRows([])
          setFileName('')
        }
      }}
    >
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Importer un catalogue CSV</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col px-6 py-4 gap-4">
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              Colonnes attendues :{' '}
              <code className="text-xs">
                code, nom, description, type, categorie, prix_unitaire_ht, taux_tva, unite,
                est_actif
              </code>
              . Types valides : service, produit, licence, formation, maintenance.
            </AlertDescription>
          </Alert>

          <div>
            <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">{fileName || 'Choisir un fichier CSV…'}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex gap-2">
                <Badge variant="default">{valid} valides</Badge>
                {invalid > 0 && <Badge variant="destructive">{invalid} en erreur</Badge>}
              </div>
              <ScrollArea className="flex-1 min-h-0 border rounded-md">
                <div className="p-2 space-y-1">
                  {rows.slice(0, 100).map((r, i) => (
                    <div
                      key={`row-${i}-${r.code || r.nom || ''}`}
                      className={`text-xs p-2 rounded ${r._errors ? 'bg-destructive/10' : 'bg-muted/30'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{r.code || '∅'}</span>
                        <span className="truncate">{r.nom}</span>
                        <span className="ml-auto">{r.prix_unitaire_ht}€</span>
                      </div>
                      {r._errors && (
                        <div className="mt-1 flex items-start gap-1 text-destructive">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{r._errors.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {rows.length > 100 && (
                    <div className="text-xs text-center text-muted-foreground py-2">
                      … et {rows.length - 100} autres lignes
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleImport} disabled={!valid || isImporting}>
            Importer {valid > 0 ? `(${valid})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
