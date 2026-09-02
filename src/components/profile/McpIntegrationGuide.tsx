import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Plug, Key, Terminal, Wrench, Copy, Check, AlertTriangle, Zap, Users, DollarSign, BookOpen, Headphones, BarChart3, FileText, Mail, Calendar, HeartPulse, Monitor, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react'
import { supabase } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'

const MCP_SERVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-server`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const TOOL_CATEGORIES = [
  { name: 'Core', icon: Zap, count: 8, examples: 'query_database, send_email, create_task, schedule_meeting, search_knowledge_base' },
  { name: 'CRM', icon: Users, count: 10, examples: 'manage_etablissement, manage_contact, manage_groupe, score_prospects' },
  { name: 'Trésorerie', icon: DollarSign, count: 9, examples: 'sync_qonto_transactions, get_bank_balance, create_invoice, forecast_cashflow' },
  { name: 'RH', icon: Users, count: 7, examples: 'parse_payslip, manage_absence, calculate_payroll_kpis, get_employee_dossier' },
  { name: 'R&D Agile', icon: Wrench, count: 6, examples: 'manage_epic, manage_user_story, manage_sprint, calculate_rd_metrics' },
  { name: 'Support', icon: Headphones, count: 4, examples: 'create_support_ticket, update_ticket_status, assign_ticket, get_support_kpis' },
  { name: 'Communication', icon: Mail, count: 5, examples: 'translate_email, correct_email, reformulate_email, suggest_email_response' },
  { name: 'Calendrier', icon: Calendar, count: 6, examples: 'get_my_calendar, create_recurring_event, detect_calendar_conflicts' },
  { name: 'Formations', icon: BookOpen, count: 4, examples: 'create_training_session, register_attendance, get_training_analytics' },
  { name: 'Analytics', icon: BarChart3, count: 6, examples: 'get_dashboard_summary, get_daily_digest, analyze_trends, detect_anomalies' },
  { name: 'Documents', icon: FileText, count: 4, examples: 'search_documents, index_document, list_files, manage_document' },
  { name: 'Admin', icon: Key, count: 5, examples: 'manage_user, manage_user_role, get_system_logs, export_data_rgpd' },
]

interface HealthCheckResult {
  status: 'idle' | 'loading' | 'ok' | 'error'
  toolsCount?: number
  latencyMs?: number
  error?: string
}

export function McpIntegrationGuide() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [healthCheck, setHealthCheck] = useState<HealthCheckResult>({ status: 'idle' })

  const generateToken = async () => {
    setLoading(true)
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        toast.error('Impossible de récupérer la session. Reconnectez-vous.')
        return
      }
      setToken(session.access_token)
      toast.success('Token généré avec succès')
    } catch {
      toast.error('Erreur lors de la génération du token')
    } finally {
      setLoading(false)
    }
  }

  const runHealthCheck = async () => {
    setHealthCheck({ status: 'loading' })
    const start = performance.now()
    try {
      const res = await fetch(`${MCP_SERVER_URL}?health=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
      })
      const latencyMs = Math.round(performance.now() - start)
      if (!res.ok) {
        setHealthCheck({ status: 'error', error: `HTTP ${res.status}`, latencyMs })
        return
      }
      const data = await res.json()
      setHealthCheck({
        status: 'ok',
        toolsCount: data.tools_count || 0,
        latencyMs,
      })
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - start)
      const message = err instanceof Error ? err.message : 'Réseau injoignable'
      setHealthCheck({ status: 'error', error: message, latencyMs })
    }
  }

  const copyToClipboard = async (text: string, type: 'token' | 'config') => {
    await navigator.clipboard.writeText(text)
    if (type === 'token') {
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    } else {
      setCopiedConfig(true)
      setTimeout(() => setCopiedConfig(false), 2000)
    }
    toast.success('Copié !')
  }

  const configJson = JSON.stringify({
    mcpServers: {
      marque: {
        type: 'streamable-http',
        url: MCP_SERVER_URL,
        headers: {
          Authorization: `Bearer ${token || '<VOTRE_TOKEN>'}`,
          apikey: SUPABASE_ANON_KEY,
        }
      }
    }
  }, null, 2)

  return (
    <div className="space-y-6">
      {/* Section 1 — Présentation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Protocole MCP — Model Context Protocol</CardTitle>
              <CardDescription>
                Connectez Claude Desktop ou Claude Code à OpenPulse
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Le protocole MCP permet à Claude d'interagir directement avec l'ensemble de vos outils OpenPulse :
            CRM, emails, trésorerie, RH, R&D, support, calendrier, formations, contrats, documents…
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <Zap className="h-3 w-3" />
              135+ outils disponibles
            </Badge>
            <Badge variant="outline">Temps réel</Badge>
            <Badge variant="outline">Sécurisé (JWT)</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Section — Compatibilité Cowork vs Desktop */}
      <Card className="border-amber-500/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Info className="h-5 w-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Compatibilité par client Claude</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Claude Desktop */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary shrink-0" />
                <span className="font-medium text-sm">Claude Desktop</span>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Recommandé</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Fonctionne directement. Configurez le serveur MCP dans Settings → Developer → MCP Servers.
              </p>
            </div>

            {/* Claude Code CLI */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary shrink-0" />
                <span className="font-medium text-sm">Claude Code (CLI)</span>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Compatible</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Fonctionne directement. Éditez <code className="bg-muted px-1 py-0.5 rounded">~/.claude/settings.json</code>.
              </p>
            </div>
          </div>

          {/* Cowork warning */}
          <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/5 text-amber-800 dark:text-amber-300 [&>svg]:text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">Clients MCP — Restrictions réseau</AlertTitle>
            <AlertDescription className="text-xs space-y-2">
              <p>
                Certains clients MCP utilisent un proxy réseau qui peut <strong>bloquer les connexions</strong> vers les domaines Azure
                (<code className="bg-muted px-1 py-0.5 rounded text-[10px]">le domaine de votre instance</code>). Si le serveur MCP charge <strong>0 outil</strong>,
                c'est très probablement un blocage réseau, pas un problème de configuration.
              </p>
              <p className="font-medium">Solutions :</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Vérifier si le domaine <code className="bg-muted px-1 py-0.5 rounded text-[10px]">supabase.openpulse.example.org</code> est autorisé dans les paramètres réseau du client</li>
                <li>Utiliser le domaine Azure Gestion ou un domaine personnalisé autorisé</li>
                <li>Tester avec un client MCP respectant les politiques réseau OpenPulse</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Section — Health Check */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <HeartPulse className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Diagnostic rapide</CardTitle>
              <CardDescription>Vérifiez l'accessibilité du serveur MCP depuis votre navigateur</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runHealthCheck} disabled={healthCheck.status === 'loading'} variant="outline" className="gap-2">
            {healthCheck.status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HeartPulse className="h-4 w-4" />
            )}
            Tester la connexion MCP
          </Button>

          {healthCheck.status === 'ok' && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="font-medium text-sm">Serveur MCP accessible</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Outils disponibles : <strong className="text-foreground">{healthCheck.toolsCount}</strong></div>
                <div>Latence : <strong className="text-foreground">{healthCheck.latencyMs} ms</strong></div>
              </div>
              <p className="text-xs text-muted-foreground">
                ✅ Si Claude Desktop/Code ne charge pas les outils, vérifiez votre token JWT (étape 1) et la configuration JSON (étape 2).
              </p>
            </div>
          )}

          {healthCheck.status === 'error' && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5 shrink-0" />
                <span className="font-medium text-sm">Serveur MCP inaccessible</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Erreur : <code className="bg-muted px-1 py-0.5 rounded">{healthCheck.error}</code>
                {healthCheck.latencyMs != null && ` (${healthCheck.latencyMs} ms)`}
              </p>
              <p className="text-xs text-muted-foreground">
                ⚠️ Si vous êtes sur Claude Cowork, le domaine Supabase est probablement bloqué par le proxy réseau. 
                Essayez Claude Desktop ou Claude Code.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 — Token */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-500" />
                Récupérer votre token
              </CardTitle>
              <CardDescription>Token d'authentification JWT pour le serveur MCP</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={generateToken} disabled={loading} className="gap-2">
            <Key className="h-4 w-4" />
            {loading ? 'Génération…' : 'Générer mon token'}
          </Button>

          {token && (
            <div className="space-y-3">
              <div className="relative">
                <pre className="bg-muted rounded-lg p-3 pr-12 text-xs overflow-x-auto break-all whitespace-pre-wrap font-mono max-h-24">
                  {token}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(token, 'token')} aria-label="Valider">
                  {copiedToken ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Ce token est lié à votre session et expire après ~1h. Reconnectez-vous à OpenPulse et regénérez un token si Claude ne parvient plus à se connecter.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3 — Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              2
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-4 w-4 text-green-500" />
                Configurer Claude
              </CardTitle>
              <CardDescription>Ajoutez le serveur MCP dans Claude Desktop ou Code</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-medium">Étapes :</p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>
                <strong>Claude Desktop :</strong> Settings → Developer → MCP Servers → Edit Config
              </li>
              <li>
                <strong>Claude Code :</strong> Éditez <code className="bg-muted px-1 py-0.5 rounded text-xs">~/.claude/settings.json</code>
              </li>
              <li>Collez la configuration ci-dessous</li>
              <li>Redémarrez Claude</li>
            </ol>
          </div>

          <div className="relative">
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono">
              <code>{configJson}</code>
            </pre>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2 gap-1"
              onClick={() => copyToClipboard(configJson, 'config')}
            >
              {copiedConfig ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedConfig ? 'Copié' : 'Copier'}
            </Button>
          </div>

          {!token && (
            <p className="text-xs text-muted-foreground italic">
              💡 Générez d'abord votre token (étape 1) pour obtenir une configuration pré-remplie.
            </p>
          )}

          {/* Checklist */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-medium">Checklist de vérification :</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 shrink-0" />
                <span>Type de transport : <code className="bg-muted px-1 py-0.5 rounded">streamable-http</code></span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 shrink-0" />
                <span>URL : <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{MCP_SERVER_URL}</code></span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 shrink-0" />
                <span>Header Authorization : <code className="bg-muted px-1 py-0.5 rounded">Bearer &lt;TOKEN&gt;</code></span>
              </li>
              <li className="flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                <span>Token non expiré (regénérer après reconnexion)</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Section 4 — Outils disponibles */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              3
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wrench className="h-4 w-4 text-purple-500" />
                Outils disponibles
              </CardTitle>
              <CardDescription>Demandez simplement à Claude ce que vous voulez faire</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Claude utilisera automatiquement les bons outils parmi les catégories suivantes :
          </p>

          <Accordion type="multiple" className="w-full">
            {TOOL_CATEGORIES.map((cat) => (
              <AccordionItem key={cat.name} value={cat.name}>
                <AccordionTrigger className="text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <cat.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{cat.name}</span>
                    <Badge variant="secondary" className="text-xs ml-1">{cat.count}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground font-mono">{cat.examples}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
