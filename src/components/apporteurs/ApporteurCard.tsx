import { ArrowRight, CalendarClock, ExternalLink, History } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn, formatNumber } from '@/lib/utils'
import type { Apporteur, ApporteurStatut, ClientStatut, ExchangeCanal } from './types'
import { useApporteurContextData } from './useApporteurContextData'
import { scoreColor } from '@/config/partenariatSante'

function SanteScoreRing({
  score,
  size = 44,
  stroke = 5,
}: {
  score: number
  size?: number
  stroke?: number
}) {
  const clamped = Math.max(0, Math.min(100, score))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)
  const color = scoreColor(clamped)
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={`Score santé ${Math.round(clamped)} sur 100`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="52%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.36}
        fontWeight={700}
        fill="hsl(var(--foreground))"
      >
        {Math.round(clamped)}
      </text>
    </svg>
  )
}

const STATUT_LABEL: Record<ApporteurStatut, string> = {
  sain: 'Sain',
  a_surveiller: 'À surveiller',
  en_negociation: 'En négociation',
}

const STATUT_CLASSES: Record<ApporteurStatut, string> = {
  sain: 'bg-success/15 text-success border-success/30',
  a_surveiller: 'bg-warning/15 text-warning border-warning/30',
  en_negociation: 'bg-muted text-muted-foreground border-border',
}

const CLIENT_STATUT_LABEL: Record<ClientStatut, string> = {
  signe: 'Signé',
  onboarding: 'Onboarding',
  churne: 'Churné',
}

const CLIENT_STATUT_CLASSES: Record<ClientStatut, string> = {
  signe: 'bg-success/10 text-success border-success/20',
  onboarding: 'bg-primary/10 text-primary border-primary/20',
  churne: 'bg-destructive/10 text-destructive border-destructive/20',
}

const CANAL_COLORS: Record<ExchangeCanal, string> = {
  Email: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  Visio: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  Téléphone: 'bg-green-500/10 text-green-700 dark:text-green-300',
  RDV: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
}

function initials(nom: string): string {
  return nom
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDateFR(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export interface ApporteurTopEntry {
  nom: string
  ca: number
  statut: string
}

interface ApporteurCardProps {
  apporteur: Apporteur
  className?: string
  compact?: boolean
  /** Destination du clic sur le nom : 'tab' (onglet AA) ou 'partenaire' (fiche partenaire). */
  nameLinkTo?: 'tab' | 'partenaire'
  /** Valeur calculée qui remplace la métrique statique "Clients apportés". */
  clientsApportesOverride?: number
  /** Valeur calculée qui remplace la métrique statique "Prospects actifs". */
  prospectsActifsOverride?: number
  /** Valeur calculée qui remplace la métrique statique "Taux conversion". `null` = N/A (division par zéro). */
  tauxConversionOverride?: number | null
  /** Valeur calculée qui remplace la métrique statique "ARR généré" (en €). */
  arrGenereOverride?: number
  /** Top 3 clients calculés depuis le tableau de prospection réel. */
  topClientsOverride?: ApporteurTopEntry[]
  /** Top 3 prospects calculés depuis le tableau de prospection réel. */
  topProspectsOverride?: ApporteurTopEntry[]
  /** Score global de santé du partenariat (0-100). Remplace le badge statut si fourni. */
  santeScoreOverride?: number
}

export function ApporteurCard({
  apporteur,
  className,
  compact,
  nameLinkTo = 'tab',
  clientsApportesOverride,
  prospectsActifsOverride,
  tauxConversionOverride,
  arrGenereOverride,
  topClientsOverride,
  topProspectsOverride,
  santeScoreOverride,
}: ApporteurCardProps) {
  const a = apporteur
  const clientsApportesLinked = typeof clientsApportesOverride === 'number'
  const clientsApportesValue = clientsApportesLinked
    ? clientsApportesOverride
    : a.metrics.clientsApportes
  const prospectsActifsLinked = typeof prospectsActifsOverride === 'number'
  const prospectsActifsValue = prospectsActifsLinked
    ? prospectsActifsOverride
    : a.metrics.prospectsActifs
  const tauxConversionLinked =
    typeof tauxConversionOverride === 'number' || tauxConversionOverride === null
  const tauxConversionValue =
    tauxConversionOverride === null
      ? 'N/A'
      : typeof tauxConversionOverride === 'number'
        ? `${tauxConversionOverride.toFixed(1)}%`
        : `${a.metrics.tauxConversion}%`
  const arrGenereLinked = typeof arrGenereOverride === 'number'
  const arrGenereValue = arrGenereLinked ? arrGenereOverride : a.metrics.arrGenere

  const topClients: Array<{ nom: string; ca: number; statut: string; seedStatut?: ClientStatut }> =
    topClientsOverride
      ? topClientsOverride.slice(0, 3)
      : [...a.clients]
          .sort((x, y) => (y.ca ?? 0) - (x.ca ?? 0))
          .slice(0, 3)
          .map((c) => ({ nom: c.nom, ca: c.ca ?? 0, statut: c.statut, seedStatut: c.statut }))

  const topProspects: Array<{ nom: string; ca: number; statut: string }> = topProspectsOverride
    ? topProspectsOverride.slice(0, 3)
    : [...a.prospects]
        .sort((x, y) => (y.ca ?? 0) - (x.ca ?? 0))
        .slice(0, 3)
        .map((p) => ({ nom: p.nom, ca: p.ca ?? 0, statut: p.stade }))

  const { exchanges: dbExchanges, nextSteps: dbNextSteps } = useApporteurContextData(a.id)

  const sourceExchanges = dbExchanges
  const sourceNextSteps = dbNextSteps

  const displayedExchanges = [...sourceExchanges]
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .slice(0, 2)

  const displayedNextSteps = [...sourceNextSteps]
    .sort((x, y) => (x.echeance < y.echeance ? -1 : x.echeance > y.echeance ? 1 : 0))
    .slice(0, 2)

  const hasActivitySection = displayedExchanges.length > 0 || displayedNextSteps.length > 0

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-5 space-y-4">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-11 w-11 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials(a.nom)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {nameLinkTo === 'partenaire' && a.partenaireId ? (
                <Link
                  to={`/partenaires/${a.partenaireId}`}
                  className="font-semibold text-base truncate hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  title="Voir la fiche partenaire"
                >
                  <span className="truncate">{a.nom}</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />
                </Link>
              ) : a.id ? (
                <Link
                  to={`/apporteurs-affaires?tab=${a.id}`}
                  className="font-semibold text-base truncate hover:text-primary transition-colors inline-flex items-center gap-1 group"
                >
                  <span className="truncate">{a.nom}</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />
                </Link>
              ) : (
                <h3 className="font-semibold text-base truncate">{a.nom}</h3>
              )}
              <p className="text-xs text-muted-foreground truncate">{a.typePartenariat}</p>
            </div>
          </div>
          {typeof santeScoreOverride === 'number' ? (
            <SanteScoreRing score={santeScoreOverride} />
          ) : (
            <Badge variant="outline" className={cn('shrink-0', STATUT_CLASSES[a.statut])}>
              {STATUT_LABEL[a.statut]}
            </Badge>
          )}
        </div>

        {/* Métriques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MetricTile
            label="Clients apportés"
            value={clientsApportesValue}
            draft={compact && !clientsApportesLinked}
          />
          <MetricTile
            label="Prospects actifs"
            value={prospectsActifsValue}
            draft={compact && !prospectsActifsLinked}
          />
          <MetricTile
            label="Taux conversion"
            value={tauxConversionValue}
            draft={compact && !tauxConversionLinked}
          />
          <MetricTile
            label="ARR généré"
            value={`${formatNumber(arrGenereValue)}€`}
            draft={compact && !arrGenereLinked}
          />
        </div>

        {!compact && (
          <>
            {/* Colonnes clients / prospects */}
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Clients apportés
                </h4>
                {topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Aucun client pour l'instant
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {topClients.map((c) => (
                      <li key={c.nom} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate" title={c.nom}>
                          {c.nom}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {formatNumber(c.ca ?? 0)}€
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0 shrink-0',
                              c.seedStatut ? CLIENT_STATUT_CLASSES[c.seedStatut] : undefined
                            )}
                          >
                            {c.seedStatut ? CLIENT_STATUT_LABEL[c.seedStatut] : c.statut}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Prospects ciblés
                </h4>
                {topProspects.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Aucun prospect ciblé</p>
                ) : (
                  <ul className="space-y-1.5">
                    {topProspects.map((p) => (
                      <li key={p.nom} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate" title={p.nom}>
                          {p.nom}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {formatNumber(p.ca ?? 0)}€
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {p.statut}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Échanges récents & Next steps */}
            {hasActivitySection && (
              <div className="border-t pt-3 space-y-3">
                {displayedExchanges.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Échanges récents
                      </h4>
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <ul className="space-y-1.5">
                      {displayedExchanges.map((ex) => (
                        <li key={ex.id} className="flex items-start gap-1 text-sm">
                          <span className="text-xs text-muted-foreground w-11 shrink-0 pt-0.5">
                            {formatDateFR(ex.date)}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`${CANAL_COLORS[ex.canal]} shrink-0 text-[10px] px-1.5 py-0`}
                          >
                            {ex.canal}
                          </Badge>
                          <span className="text-foreground/90 leading-snug flex-1">
                            {ex.resume}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {displayedNextSteps.length > 0 && (
                  <div className={displayedExchanges.length > 0 ? 'pt-3 border-t' : undefined}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Next steps
                      </h4>
                      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <ul className="space-y-1.5">
                      {displayedNextSteps.map((ns) => (
                        <li key={ns.id} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium leading-snug">{ns.action}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDateFR(ns.echeance)}
                              {ns.owner ? ` · ${ns.owner}` : ''}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function MetricTile({
  label,
  value,
  draft,
}: {
  label: string
  value: string | number
  draft?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg px-3 py-2 flex flex-col',
        draft ? 'bg-destructive/15' : 'bg-muted/40'
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className="text-lg font-semibold text-foreground mt-auto">{value}</div>
    </div>
  )
}
