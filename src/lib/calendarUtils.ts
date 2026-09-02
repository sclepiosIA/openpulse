import { format, parseISO } from 'date-fns'

export function getEtablissementColor(etablissementId: string, etablissementNom: string): string {
  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ]

  const hash = (etablissementId + etablissementNom)
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)

  return colors[hash % colors.length]
}

export function getPriorityColor(priorite: string): string {
  switch (priorite) {
    case 'high':
      return 'hsl(var(--destructive))'
    case 'medium':
      return 'hsl(var(--warning))'
    case 'low':
      return 'hsl(var(--success))'
    default:
      return 'hsl(var(--muted))'
  }
}

export function getPriorityLabel(priorite: string): string {
  switch (priorite) {
    case 'high':
      return 'Haute'
    case 'medium':
      return 'Moyenne'
    case 'low':
      return 'Basse'
    default:
      return 'Non définie'
  }
}

export function getStatusColor(statut: string): string {
  switch (statut) {
    case 'terminee':
      return 'hsl(var(--success))'
    case 'en_cours':
      return 'hsl(var(--primary))'
    case 'en_attente':
      return 'hsl(var(--warning))'
    case 'bloquee':
      return 'hsl(var(--destructive))'
    default:
      return 'hsl(var(--muted))'
  }
}

export function getStatusLabel(statut: string): string {
  switch (statut) {
    case 'terminee':
      return 'Terminée'
    case 'en_cours':
      return 'En cours'
    case 'en_attente':
      return 'En attente'
    case 'bloquee':
      return 'Bloquée'
    default:
      return statut
  }
}

export interface ICSTask {
  id: string;
  titre: string;
  echeance?: string | null;
  description?: string | null;
  statut?: string | null;
  priorite?: string | null;
}

export function exportToICS(tasks: ICSTask[], title: string = 'Calendrier des tâches'): void {
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Marque//Calendar//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${title}`,
    'X-WR-TIMEZONE:Europe/Paris',
    ...tasks.flatMap((task) => {
      if (!task.echeance) return []

      const dateStr = format(parseISO(task.echeance!), 'yyyyMMdd')
      return [
        'BEGIN:VEVENT',
        `UID:${task.id}@marque.app`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${dateStr}`,
        `SUMMARY:${task.titre}`,
        `DESCRIPTION:${task.description || ''}`,
        `STATUS:${task.statut === 'terminee' ? 'COMPLETED' : 'CONFIRMED'}`,
        `PRIORITY:${task.priorite === 'high' ? '1' : task.priorite === 'medium' ? '5' : '9'}`,
        'END:VEVENT',
      ]
    }),
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function calculateWorkload(taskCount: number): 'low' | 'medium' | 'high' {
  if (taskCount === 0) return 'low'
  if (taskCount <= 3) return 'low'
  if (taskCount <= 6) return 'medium'
  return 'high'
}

interface LaneTask {
  startDay: number;
  [key: string]: unknown;
}

/**
 * Détecte si deux tâches se chevauchent visuellement sur la timeline
 */
function detectTaskOverlap(task1: LaneTask, task2: LaneTask, totalDays: number): boolean {
  const left1 = (task1.startDay / totalDays) * 100
  const left2 = (task2.startDay / totalDays) * 100
  const taskWidth = 5 // pourcentage approximatif de largeur minimum d'une tâche
  return Math.abs(left1 - left2) < taskWidth
}

/**
 * Organise les tâches en lanes (lignes) pour éviter les chevauchements visuels
 */
export function organizeTasks<T extends LaneTask>(tasks: T[], totalDays: number): T[][] {
  if (tasks.length === 0) return [[]]

  // Trier les tâches par date de début
  const sortedTasks = [...tasks].sort((a, b) => a.startDay - b.startDay)

  const lanes: T[][] = []

  sortedTasks.forEach((task) => {
    let placed = false

    // Essayer de placer la tâche dans une lane existante
    for (const lane of lanes) {
      const hasConflict = lane.some((existingTask) =>
        detectTaskOverlap(existingTask, task, totalDays)
      )

      if (!hasConflict) {
        lane.push(task)
        placed = true
        break
      }
    }

    // Si pas de place trouvée, créer une nouvelle lane
    if (!placed) {
      lanes.push([task])
    }
  })

  return lanes
}

/**
 * Calcule la couleur de texte appropriée en fonction de la luminosité du fond
 */
export function getTextColor(bgColor: string): string {
  // Si c'est un format HSL
  if (bgColor.includes('hsl')) {
    const match = bgColor.match(/hsl\(var\(--([^)]+)\)\)/)
    if (match) {
      // Pour les couleurs du design system, utiliser des règles prédéfinies
      const colorVar = match[1]
      if (colorVar.includes('destructive') || colorVar.includes('primary')) {
        return '#FFFFFF'
      }
    }

    // Parser HSL format: hsl(h, s%, l%)
    const hslMatch = bgColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (hslMatch) {
      const lightness = parseInt(hslMatch[3])
      return lightness > 50 ? '#000000' : '#FFFFFF'
    }
  }

  // Fallback: blanc par défaut
  return '#FFFFFF'
}

/**
 * Retourne les styles de priorité pour les tâches du calendrier
 */
export function getTaskPriorityStyles(priorite?: string): {
  bg: string
  text: string
  border: string
} {
  switch (priorite) {
    case 'high':
      return {
        bg: 'bg-red-100 dark:bg-red-950/50',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-400 dark:border-red-600',
      }
    case 'medium':
      return {
        bg: 'bg-amber-100 dark:bg-amber-950/50',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-400 dark:border-amber-600',
      }
    case 'low':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-950/50',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-400 dark:border-emerald-600',
      }
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-800/50',
        text: 'text-slate-600 dark:text-slate-300',
        border: 'border-slate-300 dark:border-slate-600',
      }
  }
}

/**
 * Retourne les styles de statut pour les tâches du calendrier
 */
export function getTaskStatusStyles(statut: string): { bg: string; text: string; border: string } {
  switch (statut?.toLowerCase()) {
    case 'terminé':
    case 'terminee':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-950/50',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-400 dark:border-emerald-600',
      }
    case 'bloqué':
    case 'bloquee':
      return {
        bg: 'bg-red-100 dark:bg-red-950/50',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-400 dark:border-red-600',
      }
    case 'en cours':
    case 'en_cours':
      return {
        bg: 'bg-blue-100 dark:bg-blue-950/50',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-400 dark:border-blue-600',
      }
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-800/50',
        text: 'text-slate-600 dark:text-slate-300',
        border: 'border-slate-300 dark:border-slate-600',
      }
  }
}

/**
 * Retourne une couleur solide pour les bandeaux de tâches (zone journée)
 */
export function getStatusSolidColor(statut: string): string {
  switch (statut?.toLowerCase()) {
    case 'terminé':
    case 'terminee':
      return '#10B981' // Emerald-500
    case 'bloqué':
    case 'bloquee':
      return '#EF4444' // Red-500
    case 'en cours':
    case 'en_cours':
      return '#3B82F6' // Blue-500
    default:
      return '#6366F1' // Indigo-500
  }
}

// ============= ICS Single Event Export =============

interface SingleEventICSParams {
  id: string
  title: string
  description?: string
  start: Date
  end: Date
  location?: string
  videoUrl?: string
  organizer?: { name: string; email: string }
  attendees?: Array<{ name?: string; email: string }>
}

function escapeICSText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatICSDateTimeZ(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/**
 * Generate ICS content for a single calendar event
 */
export function generateSingleEventICS(event: SingleEventICSParams): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Marque//Calendar Event//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'X-WR-TIMEZONE:Europe/Paris',
    'BEGIN:VEVENT',
    `UID:event-${event.id}@marque.app`,
    `DTSTAMP:${formatICSDateTimeZ(new Date())}`,
    `DTSTART:${formatICSDateTimeZ(event.start)}`,
    `DTEND:${formatICSDateTimeZ(event.end)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`)
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICSText(event.location)}`)
  }

  if (event.videoUrl) {
    lines.push(`URL:${event.videoUrl}`)
    // Also add as X-GOOGLE-CONFERENCE for Google Calendar
    lines.push(`X-GOOGLE-CONFERENCE:${event.videoUrl}`)
  }

  if (event.organizer) {
    lines.push(
      `ORGANIZER;CN=${escapeICSText(event.organizer.name)}:mailto:${event.organizer.email}`
    )
  }

  if (event.attendees) {
    event.attendees.forEach((attendee) => {
      const cn = attendee.name ? `CN=${escapeICSText(attendee.name)};` : ''
      lines.push(`ATTENDEE;${cn}PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee.email}`)
    })
  }

  lines.push('STATUS:CONFIRMED')
  lines.push('SEQUENCE:0')
  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')

  return lines.join('\r\n')
}

/**
 * Download a single event as an ICS file
 */
export function downloadEventICS(event: SingleEventICSParams): void {
  const icsContent = generateSingleEventICS(event)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)

  // Sanitize filename
  const filename = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 50)

  link.download = `${filename}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

// ============= Visio Invitation ICS =============

export interface VisioInvitationParams {
  id: string
  title: string
  start: Date
  durationMinutes: number
  visioUrl: string
  description: string
  organizer: { name: string; email: string }
  attendees: Array<{ email: string; name?: string }>
}

/**
 * Generate ICS content for a visio invitation email
 * This ICS can be attached to an email to allow recipients to accept/decline
 */
export function generateVisioInvitationICS(params: VisioInvitationParams): string {
  const endDate = new Date(params.start.getTime() + params.durationMinutes * 60 * 1000)

  return generateSingleEventICS({
    id: params.id,
    title: params.title,
    start: params.start,
    end: endDate,
    description: params.description,
    location: params.visioUrl,
    videoUrl: params.visioUrl,
    organizer: params.organizer,
    attendees: params.attendees,
  })
}
