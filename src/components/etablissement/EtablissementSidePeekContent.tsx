import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MapPin, Mail, Phone, Building2, Users, TrendingUp } from 'lucide-react'
import type { EtablissementWithGroupLogo as Etablissement } from '@/hooks/crm/useEtablissements'
import type { ProfileForTable } from '@/types/taches-analytics'
import { cn } from '@/lib/utils'

interface EtablissementSidePeekContentProps {
  etab: Etablissement
  profiles?: ProfileForTable[]
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
}

export function EtablissementSidePeekContent({ etab, profiles = [] }: EtablissementSidePeekContentProps) {
  const findProfile = (id?: string | null) =>
    id ? profiles.find((p) => p.id === id) : undefined

  const team = [
    { role: 'Commercial', profile: findProfile((etab as any).commercial_id) },
    { role: 'Chef de projet', profile: findProfile((etab as any).chef_projet_id) },
    { role: 'CSM', profile: findProfile((etab as any).csm_id) },
  ].filter((t) => t.profile)

  const progression = (etab as any).progression ?? 0
  const score = (etab as any).score_conversion
  const dpi = (etab as any).dpi
  const email = (etab as any).email_contact || (etab as any).email
  const telephone = (etab as any).telephone || (etab as any).tel

  return (
    <div className="space-y-5">
      {/* Header avatar + name */}
      <div className="flex items-start gap-3">
        <EntityAvatar
          name={etab.nom}
          logoUrl={etab.logo_url || etab.groupe_logo_url}
          size="lg"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight truncate">{etab.nom}</h2>
          {(etab.ville || etab.region) && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {[etab.ville, etab.region].filter(Boolean).join(' · ')}
              </span>
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {etab.statut && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5">
                {etab.statut}
              </Badge>
            )}
            {dpi && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-5">
                DPI · {dpi}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Progression */}
      <section>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground font-medium">Progression</span>
          <span className="font-medium tabular-nums">{Math.round(progression)}%</span>
        </div>
        <Progress value={progression} className="h-1.5" />
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-3 gap-2">
        <KpiCard
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Score"
          value={typeof score === 'number' ? `${Math.round(score)}` : '—'}
        />
        <KpiCard
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="Type"
          value={(etab as any).type || '—'}
        />
        <KpiCard
          icon={<Users className="w-3.5 h-3.5" />}
          label="Équipe"
          value={team.length > 0 ? String(team.length) : '—'}
        />
      </section>

      {/* Team */}
      {team.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Équipe
          </h3>
          <div className="space-y-1.5">
            {team.map((t) => {
              const p = t.profile!
              const fullName = `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || 'Sans nom'
              return (
                <div key={t.role} className="flex items-center gap-2 text-xs">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">{getInitials(fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{fullName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.role}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Quick contact actions */}
      {(email || telephone) && (
        <section className="flex gap-2">
          {email && (
            <Button asChild size="sm" variant="outline" className="flex-1 h-8 gap-1.5">
              <a href={`mailto:${email}`}>
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">Email</span>
              </a>
            </Button>
          )}
          {telephone && (
            <Button asChild size="sm" variant="outline" className="flex-1 h-8 gap-1.5">
              <a href={`tel:${telephone}`}>
                <Phone className="w-3.5 h-3.5" />
                <span className="truncate">Appeler</span>
              </a>
            </Button>
          )}
        </section>
      )}
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('rounded-md border bg-card px-2.5 py-2', className)}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums truncate">{value}</div>
    </div>
  )
}
