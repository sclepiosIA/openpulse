import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Lock, Clock, FileText, Loader2 } from 'lucide-react'
import { SUPABASE_URL } from '@/lib/supabaseBrowser'

const FN_URL = `${SUPABASE_URL}/functions/v1/download-email-transfer`

interface TransferFile {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
}
interface TransferMeta {
  token: string
  sender_email: string
  subject?: string
  message?: string
  expires_at: string
  file_count: number
  total_size_bytes: number
  download_count: number
  password_required: boolean
  files: TransferFile[]
}

function isTransferMeta(value: unknown): value is TransferMeta {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TransferMeta>
  return (
    typeof candidate.sender_email === 'string' &&
    typeof candidate.expires_at === 'string' &&
    typeof candidate.file_count === 'number' &&
    typeof candidate.total_size_bytes === 'number' &&
    typeof candidate.password_required === 'boolean' &&
    Array.isArray(candidate.files)
  )
}

function readApiError(value: unknown): string {
  if (value && typeof value === 'object' && 'error' in value) {
    const error = (value as { error?: unknown }).error
    if (typeof error === 'string' && error.trim()) return error
  }
  return 'Erreur'
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} Mo`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} Go`
}

export default function PublicTransfer() {
  const { token } = useParams<{ token: string }>()
  const [meta, setMeta] = useState<TransferMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [pwdValidated, setPwdValidated] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`${FN_URL}?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const payload: unknown = await r.json()
        if (!r.ok) throw new Error(readApiError(payload))
        if (!isTransferMeta(payload)) {
          throw new Error('Lien de transfert invalide ou expiré')
        }
        setMeta(payload)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  const verifyPassword = async () => {
    if (!token) return
    setChecking(true)
    try {
      const r = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      setPwdValidated(r.ok)
      if (!r.ok) setError('Mot de passe incorrect')
      else setError(null)
    } finally {
      setChecking(false)
    }
  }

  const download = (fileId: string, filename: string) => {
    if (!token) return
    const params = new URLSearchParams({ token, file: fileId })
    if (meta?.password_required) params.set('p', password)
    const url = `${FN_URL}?${params.toString()}`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !meta) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Transfert indisponible</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!meta) return null

  const expired = new Date(meta.expires_at).getTime() < Date.now()
  const expiresLabel = new Date(meta.expires_at).toLocaleString('fr-FR')
  const canDownload = !meta.password_required || pwdValidated

  return (
    <div className="min-h-dvh bg-gradient-to-b from-primary/5 to-background p-4 flex items-center justify-center">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-6 w-6 text-primary" />
            Fichiers partagés
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            De <span className="font-medium">{meta.sender_email}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {meta.subject && <p className="font-semibold">{meta.subject}</p>}
          {meta.message && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{meta.message}</p>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {expired ? (
              <span className="text-destructive">Expiré</span>
            ) : (
              <span>Disponible jusqu'au {expiresLabel}</span>
            )}
          </div>

          {meta.password_required && !pwdValidated && (
            <div className="space-y-2 p-4 border rounded bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4" />
                Ce transfert est protégé par mot de passe
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                  placeholder="Mot de passe"
                />
                <Button onClick={verifyPassword} disabled={checking || !password}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Valider'}
                </Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {meta.file_count} fichier{meta.file_count > 1 ? 's' : ''} ({fmtSize(meta.total_size_bytes)})
            </p>
            <div className="border rounded divide-y">
              {meta.files.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-sm">{f.filename}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {fmtSize(f.size_bytes)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canDownload || expired}
                    onClick={() => download(f.id, f.filename)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Télécharger
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground pt-4 border-t">
            Partagé via OpenPulse — Transfert sécurisé
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
