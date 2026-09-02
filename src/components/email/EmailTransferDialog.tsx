import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/shared/use-toast'
import { uploadEmailTransferFile } from '@/services/email/emailSendTransport'
import { invokeEdge } from '@/services/edgeFunctions'
import { Loader2, Upload, X, Link2, Shield, Bell, Clock } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { debug } from '@/lib/debug'

interface Props {
  open: boolean
  onClose: () => void
  /** Called once the transfer is created. Returns the public URL + metadata so the composer can inject a block. */
  onCreated: (info: {
    publicUrl: string
    token: string
    expiresAt: string
    totalSize: number
    files: Array<{ filename: string; size: number }>
  }) => void
  defaultRecipients?: string[]
}

const RETENTION_OPTIONS = [
  { value: 3, label: '3 jours' },
  { value: 7, label: '7 jours' },
  { value: 30, label: '30 jours' },
]
const MAX_FILES = 20
const MAX_TOTAL = 2 * 1024 * 1024 * 1024

function formatSize(b: number) {
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} Mo`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} Go`
}

export function EmailTransferDialog({ open, onClose, onCreated, defaultRecipients = [] }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [retention, setRetention] = useState(7)
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [notify, setNotify] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const total = files.reduce((s, f) => s + f.size, 0)

  const handleFiles = (selected: File[]) => {
    if (files.length + selected.length > MAX_FILES) {
      toast({ title: 'Trop de fichiers', description: `Max ${MAX_FILES}`, variant: 'destructive' })
      return
    }
    if (total + selected.reduce((s, f) => s + f.size, 0) > MAX_TOTAL) {
      toast({ title: 'Taille > 2 Go', variant: 'destructive' })
      return
    }
    setFiles((p) => [...p, ...selected])
  }

  const remove = (i: number) => setFiles((p) => p.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    if (!user) return
    if (files.length === 0) {
      toast({ title: 'Ajoutez au moins un fichier', variant: 'destructive' })
      return
    }
    if (usePassword && password.length < 4) {
      toast({ title: 'Mot de passe trop court (4 caractères min)', variant: 'destructive' })
      return
    }

    setUploading(true)
    setProgress(0)
    try {
      const transferPrefix = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
      const uploaded: Array<{ filename: string; mime_type: string; size_bytes: number; storage_path: string }> = []

      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        const safeName = f.name.replace(/[^\w.\-]/g, '_').slice(0, 180)
        const path = `${transferPrefix}/${i}-${safeName}`
        await uploadEmailTransferFile(path, f, f.type || 'application/octet-stream');
        uploaded.push({
          filename: f.name,
          mime_type: f.type || 'application/octet-stream',
          size_bytes: f.size,
          storage_path: path,
        })
        setProgress(Math.round(((i + 1) / files.length) * 100))
      }

      const res = await invokeEdge<any>('create-email-transfer', {
        sender_email: user.email,
        recipient_emails: defaultRecipients,
        retention_days: retention,
        password: usePassword ? password : undefined,
        notify_on_download: notify,
        files: uploaded,
      })

      if (!res?.success) throw new Error(res?.error || 'Échec création transfert')

      toast({ title: 'Transfert prêt', description: `Lien valable jusqu'au ${new Date(res.expires_at).toLocaleDateString('fr-FR')}` })

      onCreated({
        publicUrl: res.public_url,
        token: res.token,
        expiresAt: res.expires_at,
        totalSize: res.total_size_bytes,
        files: uploaded.map((u) => ({ filename: u.filename, size: u.size_bytes })),
      })
      setFiles([])
      setPassword('')
      setUsePassword(false)
      setNotify(false)
      onClose()
    } catch (e: any) {
      debug.error('[email-transfer] upload failed', e)
      toast({ title: 'Erreur', description: e?.message || 'Échec du transfert', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !uploading && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Transfert sécurisé
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label
            className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/50 block"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFiles(Array.from(e.dataTransfer.files))
            }}
          >
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(Array.from(e.target.files || []))}
              disabled={uploading}
            />
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm">Glissez vos fichiers ou cliquez</p>
            <p className="text-xs text-muted-foreground mt-1">Jusqu'à 2 Go au total, 20 fichiers</p>
          </label>

          {files.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-xs text-muted-foreground mx-2">{formatSize(f.size)}</span>
                  {!uploading && (
                    <button onClick={() => remove(i)} className="text-destructive hover:opacity-70">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-right">Total : {formatSize(total)}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Durée de rétention</Label>
            <div className="flex gap-2">
              {RETENTION_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  size="sm"
                  variant={retention === o.value ? 'default' : 'outline'}
                  onClick={() => setRetention(o.value)}
                  disabled={uploading}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Shield className="h-4 w-4" /> Protéger par mot de passe</Label>
              <Switch checked={usePassword} onCheckedChange={setUsePassword} disabled={uploading} />
            </div>
            {usePassword && (
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe (min 4 caractères)"
                disabled={uploading}
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifier à chaque téléchargement</Label>
            <Switch checked={notify} onCheckedChange={setNotify} disabled={uploading} />
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-center text-muted-foreground">Upload {progress}%</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={uploading || files.length === 0}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
            Créer le lien
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
