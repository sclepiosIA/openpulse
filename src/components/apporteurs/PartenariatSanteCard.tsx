import { useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { BarChart3, Building2, HeartHandshake, Scale, CalendarDays, Pencil } from 'lucide-react'
import {
  PARTENARIAT_SANTE_CONFIG,
  calcScoreCommercial,
  calcScoreDependance,
  calcScoreGlobal,
  monthsSince,
  scoreColor,
} from '@/config/partenariatSante'
import {
  useApporteurManualScores,
  type ManualScore,
  DEFAULT_MANUAL_SCORES,
} from './useApporteurManualScores'

interface PartenariatSanteCardProps {
  apporteurId: string
  dateDebut: string
  dateFin?: string | null
  prospectsCibles: number
  clientsSignes: number
  prospectsCiblesTousPartenaires: number
}

function formatDateFR(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR')
}

// ---------- Anneaux SVG ----------

interface RingProps {
  score: number
  size: number
  stroke: number
  showSlash?: boolean
}

function ScoreRing({ score, size, stroke, showSlash = false }: RingProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)
  const color = scoreColor(clamped)
  const fontSize = size * 0.32
  const slashSize = size * 0.16
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={`Score ${Math.round(clamped)} sur 100`}
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
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text
        x="50%"
        y={showSlash ? '48%' : '54%'}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight={700}
        fill="hsl(var(--foreground))"
      >
        {Math.round(clamped)}
      </text>
      {showSlash && (
        <text
          x="50%"
          y="70%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={slashSize}
          fill="hsl(var(--muted-foreground))"
        >
          /100
        </text>
      )}
    </svg>
  )
}

// ---------- Éditeur d'un score manuel ----------

interface ManualScoreEditorProps {
  label: string
  score: ManualScore
  onSave: (next: ManualScore) => void
}

function ManualScoreEditor({ label, score, onSave }: ManualScoreEditorProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(score.value)
  const [comment, setComment] = useState(score.comment)

  useEffect(() => {
    if (open) {
      setValue(score.value)
      setComment(score.comment)
    }
  }, [open, score])

  const canSave = comment.trim().length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={`Modifier le score ${label}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Score {label}</label>
              <span className="text-sm font-semibold">{value}/100</span>
            </div>
            <Slider
              value={[value]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setValue(v[0] ?? 0)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">
              Commentaire <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Justification du score…"
              rows={3}
              className="text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={!canSave}
              onClick={() => {
                onSave({
                  value,
                  comment: comment.trim(),
                  updatedAt: new Date().toISOString(),
                })
                setOpen(false)
              }}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------- Ligne critère ----------

interface CriterionRowProps {
  score: number
  title: string
  Icon: typeof BarChart3
  comment: string
  updatedAt?: string
  editor?: React.ReactNode
}

function CriterionRow({ score, title, Icon, comment, updatedAt, editor }: CriterionRowProps) {
  return (
    <div className="flex items-center gap-4 py-3">
      <ScoreRing score={score} size={64} stroke={7} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <h4 className="text-sm font-semibold">{title}</h4>
          {editor}
        </div>
        <p className="text-xs text-muted-foreground leading-snug mt-1">{comment}</p>
        {updatedAt && (
          <p className="text-[10px] text-muted-foreground/80 mt-0.5">
            Mis à jour le {formatDateFR(updatedAt)}
          </p>
        )}
      </div>
    </div>
  )
}

// ---------- Carte principale ----------

export function PartenariatSanteCard({
  apporteurId,
  dateDebut,
  dateFin,
  prospectsCibles,
  clientsSignes,
  prospectsCiblesTousPartenaires,
}: PartenariatSanteCardProps) {
  const { scores, updateScore } = useApporteurManualScores(apporteurId)

  const moisAnciennete = useMemo(() => monthsSince(dateDebut), [dateDebut])

  const scoreCommercial = useMemo(
    () =>
      calcScoreCommercial({
        prospectsCibles,
        clientsSignes,
        moisAnciennete,
      }),
    [prospectsCibles, clientsSignes, moisAnciennete]
  )

  const scoreDependance = useMemo(
    () =>
      calcScoreDependance({
        prospectsCiblesPartenaire: prospectsCibles,
        prospectsCiblesTousPartenaires,
      }),
    [prospectsCibles, prospectsCiblesTousPartenaires]
  )

  const scoreGlobal = useMemo(
    () =>
      calcScoreGlobal({
        commercial: scoreCommercial,
        organisation: scores.organisation.value,
        relation: scores.relation.value,
        dependance: scoreDependance,
      }),
    [scoreCommercial, scoreDependance, scores]
  )

  const tauxReel = prospectsCibles === 0 ? 0 : (clientsSignes / prospectsCibles) * 100
  const commentaireCommercial = useMemo(() => {
    const { objectifProspects } = PARTENARIAT_SANTE_CONFIG
    return `${prospectsCibles} prospect${prospectsCibles > 1 ? 's' : ''} ciblé${
      prospectsCibles > 1 ? 's' : ''
    } sur objectif ${objectifProspects} · ${clientsSignes} converti${
      clientsSignes > 1 ? 's' : ''
    } (${tauxReel.toFixed(0)}%) · ancienneté ${moisAnciennete} mois.`
  }, [prospectsCibles, clientsSignes, tauxReel, moisAnciennete])

  const commentaireDependance = useMemo(() => {
    const ratio =
      prospectsCiblesTousPartenaires === 0
        ? 0
        : (prospectsCibles / prospectsCiblesTousPartenaires) * 100
    const seuil = PARTENARIAT_SANTE_CONFIG.seuilDependance * 100
    if (ratio <= seuil) {
      return `Part de ${ratio.toFixed(0)}% du volume total (seuil ${seuil.toFixed(0)}%) : pas de dépendance excessive.`
    }
    return `Part de ${ratio.toFixed(0)}% du volume total, au-dessus du seuil ${seuil.toFixed(0)}% : dépendance à surveiller.`
  }, [prospectsCibles, prospectsCiblesTousPartenaires])

  const updateManual = (key: 'organisation' | 'relation', next: ManualScore) => {
    updateScore.mutate({ key, value: next.value, comment: next.comment })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
            <CalendarDays className="h-4 w-4 text-primary mt-0.5" />
            <div className="text-sm leading-tight">
              <div className="font-semibold text-foreground">Durée du contrat</div>
              <div className="text-muted-foreground mt-1">Début : {formatDateFR(dateDebut)}</div>
              <div className="text-muted-foreground">
                Fin : {dateFin ? formatDateFR(dateFin) : '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm font-medium text-muted-foreground leading-tight">
              <div>Santé du</div>
              <div>partenariat :</div>
            </div>
            <ScoreRing score={scoreGlobal} size={100} stroke={9} showSlash />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 divide-y">
        <CriterionRow
          score={scoreCommercial}
          title="Commercial"
          Icon={BarChart3}
          comment={commentaireCommercial}
        />
        <CriterionRow
          score={scores.organisation.value}
          title="Organisation"
          Icon={Building2}
          comment={scores.organisation.comment}
          updatedAt={scores.organisation.updatedAt}
          editor={
            <ManualScoreEditor
              label="organisation"
              score={scores.organisation}
              onSave={(v) => updateManual('organisation', v)}
            />
          }
        />
        <CriterionRow
          score={scores.relation.value}
          title="Relation"
          Icon={HeartHandshake}
          comment={scores.relation.comment}
          updatedAt={scores.relation.updatedAt}
          editor={
            <ManualScoreEditor
              label="relation"
              score={scores.relation}
              onSave={(v) => updateManual('relation', v)}
            />
          }
        />
        <CriterionRow
          score={scoreDependance}
          title="Dépendance"
          Icon={Scale}
          comment={commentaireDependance}
        />
      </CardContent>
    </Card>
  )
}
