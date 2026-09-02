/**
 * Modèles (templates) prêts à l'emploi pour le tableau blanc.
 * Chaque modèle renvoie un "skeleton" Excalidraw converti par
 * convertToExcalidrawElements() au moment de l'insertion.
 */

export type TemplateKey =
  | 'kanban'
  | 'swot'
  | 'retro'
  | 'mindmap'
  | 'timeline'
  | 'bmc'
  | 'matrix'
  | 'flow'

export interface TemplateDef {
  key: TemplateKey
  label: string
  description: string
}

export const WHITEBOARD_TEMPLATES: TemplateDef[] = [
  { key: 'kanban', label: 'Kanban', description: '3 colonnes À faire / En cours / Terminé' },
  { key: 'retro', label: 'Rétrospective', description: 'Bien / À améliorer / Actions' },
  { key: 'swot', label: 'SWOT', description: 'Forces, faiblesses, opportunités, menaces' },
  { key: 'matrix', label: 'Matrice impact/effort', description: 'Priorisation en 4 quadrants' },
  { key: 'mindmap', label: 'Mind map', description: 'Nœud central et 4 branches' },
  { key: 'timeline', label: 'Timeline', description: 'Jalons sur une ligne de temps' },
  { key: 'bmc', label: 'Business Model Canvas', description: 'Canevas 9 blocs' },
  { key: 'flow', label: 'Process', description: 'Enchaînement d’étapes fléchées' },
]

const PALETTE = {
  slate: '#e2e8f0',
  amber: '#fef3c7',
  green: '#bbf7d0',
  blue: '#bfdbfe',
  red: '#fecaca',
  violet: '#e9d5ff',
  white: '#ffffff',
}

type Skeleton = Record<string, unknown>

const frame = (
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  backgroundColor: string,
  fontSize = 20
): Skeleton => ({
  type: 'rectangle',
  x,
  y,
  width,
  height,
  backgroundColor,
  strokeColor: '#94a3b8',
  fillStyle: 'solid',
  roughness: 0,
  roundness: { type: 3 },
  label: { text: label, fontSize, fontFamily: 2, textAlign: 'center', verticalAlign: 'top' },
})

const heading = (x: number, y: number, text: string, fontSize = 28): Skeleton => ({
  type: 'text',
  x,
  y,
  text,
  fontSize,
  fontFamily: 2,
  strokeColor: '#0f172a',
})

const arrow = (x: number, y: number, width: number): Skeleton => ({
  type: 'arrow',
  x,
  y,
  width,
  height: 0,
  strokeColor: '#64748b',
  roughness: 0,
})

/** Construit le skeleton d'un modèle, ancré sur (ox, oy). */
export function buildTemplate(key: TemplateKey, ox: number, oy: number): Skeleton[] {
  switch (key) {
    case 'kanban': {
      const cols = [
        { t: 'À faire', c: PALETTE.slate },
        { t: 'En cours', c: PALETTE.blue },
        { t: 'Terminé', c: PALETTE.green },
      ]
      return [
        heading(ox, oy - 60, 'Kanban'),
        ...cols.map((col, i) => frame(ox + i * 340, oy, 300, 520, col.t, col.c, 24)),
      ]
    }
    case 'retro': {
      const cols = [
        { t: '👍 Ce qui a bien marché', c: PALETTE.green },
        { t: '👎 À améliorer', c: PALETTE.red },
        { t: '🎯 Actions', c: PALETTE.amber },
      ]
      return [
        heading(ox, oy - 60, 'Rétrospective'),
        ...cols.map((col, i) => frame(ox + i * 340, oy, 300, 480, col.t, col.c, 20)),
      ]
    }
    case 'swot': {
      const cells = [
        { t: 'Forces', c: PALETTE.green, x: 0, y: 0 },
        { t: 'Faiblesses', c: PALETTE.red, x: 1, y: 0 },
        { t: 'Opportunités', c: PALETTE.blue, x: 0, y: 1 },
        { t: 'Menaces', c: PALETTE.amber, x: 1, y: 1 },
      ]
      return [
        heading(ox, oy - 60, 'Analyse SWOT'),
        ...cells.map((c) => frame(ox + c.x * 420, oy + c.y * 320, 400, 300, c.t, c.c, 24)),
      ]
    }
    case 'matrix': {
      const cells = [
        { t: 'Quick wins\n(fort impact / faible effort)', c: PALETTE.green, x: 0, y: 0 },
        { t: 'Grands projets\n(fort impact / fort effort)', c: PALETTE.blue, x: 1, y: 0 },
        { t: 'À combler\n(faible impact / faible effort)', c: PALETTE.slate, x: 0, y: 1 },
        { t: 'À éviter\n(faible impact / fort effort)', c: PALETTE.red, x: 1, y: 1 },
      ]
      return [
        heading(ox, oy - 60, 'Impact / Effort'),
        ...cells.map((c) => frame(ox + c.x * 420, oy + c.y * 320, 400, 300, c.t, c.c, 18)),
      ]
    }
    case 'mindmap': {
      const cx = ox + 360
      const cy = oy + 240
      const branches = [
        { t: 'Branche 1', dx: -360, dy: -180 },
        { t: 'Branche 2', dx: 240, dy: -180 },
        { t: 'Branche 3', dx: -360, dy: 160 },
        { t: 'Branche 4', dx: 240, dy: 160 },
      ]
      return [
        {
          type: 'ellipse',
          x: cx - 130,
          y: cy - 70,
          width: 260,
          height: 140,
          backgroundColor: PALETTE.violet,
          strokeColor: '#7c3aed',
          fillStyle: 'solid',
          roughness: 0,
          label: { text: 'Sujet central', fontSize: 24, fontFamily: 2, textAlign: 'center' },
        },
        ...branches.map((b) => frame(cx + b.dx, cy + b.dy, 240, 110, b.t, PALETTE.white, 20)),
      ]
    }
    case 'timeline': {
      const steps = ['Jalon 1', 'Jalon 2', 'Jalon 3', 'Jalon 4']
      return [
        heading(ox, oy - 60, 'Timeline'),
        {
          type: 'line',
          x: ox,
          y: oy + 120,
          width: 1080,
          height: 0,
          strokeColor: '#94a3b8',
          roughness: 0,
        },
        ...steps.flatMap((s, i) => [
          {
            type: 'ellipse',
            x: ox + i * 340 + 100,
            y: oy + 100,
            width: 40,
            height: 40,
            backgroundColor: '#6366f1',
            strokeColor: '#4338ca',
            fillStyle: 'solid',
            roughness: 0,
          } as Skeleton,
          frame(ox + i * 340, oy + 180, 240, 140, s, PALETTE.blue, 20),
        ]),
      ]
    }
    case 'bmc': {
      const blocks: { t: string; x: number; y: number; w: number; h: number }[] = [
        { t: 'Partenaires clés', x: 0, y: 0, w: 260, h: 320 },
        { t: 'Activités clés', x: 270, y: 0, w: 260, h: 155 },
        { t: 'Ressources clés', x: 270, y: 165, w: 260, h: 155 },
        { t: 'Proposition de valeur', x: 540, y: 0, w: 260, h: 320 },
        { t: 'Relation client', x: 810, y: 0, w: 260, h: 155 },
        { t: 'Canaux', x: 810, y: 165, w: 260, h: 155 },
        { t: 'Segments clients', x: 1080, y: 0, w: 260, h: 320 },
        { t: 'Structure de coûts', x: 0, y: 330, w: 665, h: 180 },
        { t: 'Sources de revenus', x: 675, y: 330, w: 665, h: 180 },
      ]
      return [
        heading(ox, oy - 60, 'Business Model Canvas'),
        ...blocks.map((b) => frame(ox + b.x, oy + b.y, b.w, b.h, b.t, PALETTE.white, 18)),
      ]
    }
    case 'flow': {
      const steps = ['Étape 1', 'Étape 2', 'Étape 3', 'Étape 4']
      return [
        heading(ox, oy - 60, 'Processus'),
        ...steps.flatMap((s, i) => {
          const x = ox + i * 320
          const els: Skeleton[] = [frame(x, oy, 240, 130, s, PALETTE.blue, 20)]
          if (i < steps.length - 1) els.push(arrow(x + 250, oy + 65, 60))
          return els
        }),
      ]
    }
    default:
      return []
  }
}
