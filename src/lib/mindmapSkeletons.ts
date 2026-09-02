/**
 * Générateur de squelettes Excalidraw pour les cartes mentales IA.
 *
 * Layout de type MindNode : nœud central, branches réparties à gauche et à
 * droite, sous-branches empilées verticalement sans chevauchement (les hauteurs
 * de sous-arbres sont mesurées avant placement).
 */

export interface MindMapAiNode {
  title?: string
  label?: string
  note?: string
  children?: (MindMapAiNode | string)[]
}

export interface MindMapAiTree {
  central?: string
  title?: string
  branches?: (MindMapAiNode | string)[]
}

type Skeleton = Record<string, unknown>

/** Palette par branche (fond / trait) — cohérente et lisible en clair comme en sombre. */
const BRANCH_COLORS: { bg: string; stroke: string; soft: string }[] = [
  { bg: '#bfdbfe', stroke: '#2563eb', soft: '#eff6ff' },
  { bg: '#bbf7d0', stroke: '#059669', soft: '#ecfdf5' },
  { bg: '#fed7aa', stroke: '#ea580c', soft: '#fff7ed' },
  { bg: '#e9d5ff', stroke: '#7c3aed', soft: '#f5f3ff' },
  { bg: '#fecdd3', stroke: '#e11d48', soft: '#fff1f2' },
  { bg: '#a5f3fc', stroke: '#0891b2', soft: '#ecfeff' },
  { bg: '#fde68a', stroke: '#d97706', soft: '#fffbeb' },
  { bg: '#ddd6fe', stroke: '#4f46e5', soft: '#eef2ff' },
]

const LEVEL = [
  { width: 300, minHeight: 130, fontSize: 24 }, // central
  { width: 260, minHeight: 84, fontSize: 19 }, // branches
  { width: 240, minHeight: 62, fontSize: 15 }, // enfants
  { width: 220, minHeight: 52, fontSize: 13 }, // petits-enfants
]

const V_GAP = 26
const H_GAP = 90

const clean = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

const asNode = (raw: MindMapAiNode | string | undefined | null): MindMapAiNode | null => {
  if (!raw) return null
  if (typeof raw === 'string') {
    const t = clean(raw)
    return t ? { title: t } : null
  }
  const t = clean(raw.title) || clean(raw.label)
  if (!t) return null
  return { title: t, note: clean(raw.note) || undefined, children: raw.children }
}

/** Hauteur d'une boîte selon la longueur du libellé (évite les textes tronqués). */
const boxHeight = (node: MindMapAiNode, depth: number): number => {
  const cfg = LEVEL[Math.min(depth, LEVEL.length - 1)]
  const label = node.title ?? ''
  const charsPerLine = Math.max(12, Math.floor(cfg.width / (cfg.fontSize * 0.55)))
  const lines = Math.max(1, Math.ceil(label.length / charsPerLine))
  const noteLines = node.note ? Math.max(1, Math.ceil(node.note.length / (charsPerLine + 6))) : 0
  return Math.max(cfg.minHeight, 24 + lines * (cfg.fontSize + 8) + noteLines * 18)
}

interface Laid {
  node: MindMapAiNode
  depth: number
  height: number // hauteur de la boîte
  subtreeHeight: number // hauteur totale occupée par le sous-arbre
  children: Laid[]
}

const MAX_DEPTH = 3
const MAX_CHILDREN = [8, 5, 4]

const measure = (node: MindMapAiNode, depth: number): Laid => {
  const height = boxHeight(node, depth)
  const limit = MAX_CHILDREN[Math.min(depth, MAX_CHILDREN.length - 1)]
  const children =
    depth >= MAX_DEPTH
      ? []
      : (node.children ?? [])
          .map((c) => asNode(c))
          .filter((c): c is MindMapAiNode => !!c)
          .slice(0, limit)
          .map((c) => measure(c, depth + 1))
  const childrenHeight = children.length
    ? children.reduce((s, c) => s + c.subtreeHeight, 0) + (children.length - 1) * V_GAP
    : 0
  return { node, depth, height, subtreeHeight: Math.max(height, childrenHeight), children }
}

export interface MindMapBuildResult {
  elements: Skeleton[]
  branchCount: number
}

/**
 * Construit les squelettes Excalidraw d'une carte mentale centrée sur (cx, cy).
 * Retourne les nœuds puis les connecteurs (ordre attendu par Excalidraw).
 */
export function buildMindMapSkeletons(
  tree: MindMapAiTree,
  cx: number,
  cy: number,
  fallbackTitle = 'Carte mentale'
): MindMapBuildResult {
  const uid = `mm_${Date.now().toString(36)}`
  const central = clean(tree.central) || clean(tree.title) || fallbackTitle

  const branches = (tree.branches ?? [])
    .map((b) => asNode(b))
    .filter((b): b is MindMapAiNode => !!b)
    .slice(0, 8)
    .map((b) => measure(b, 1))

  const nodes: Skeleton[] = []
  const connectors: Skeleton[] = []

  const rootCfg = LEVEL[0]
  const rootHeight = boxHeight({ title: central }, 0)
  const rootId = `${uid}_root`
  nodes.push({
    type: 'ellipse',
    id: rootId,
    x: cx - rootCfg.width / 2,
    y: cy - rootHeight / 2,
    width: rootCfg.width,
    height: rootHeight,
    backgroundColor: '#312e81',
    strokeColor: '#1e1b4b',
    fillStyle: 'solid',
    roughness: 0,
    strokeWidth: 2,
    label: {
      text: central,
      fontSize: rootCfg.fontSize,
      fontFamily: 2,
      textAlign: 'center',
      verticalAlign: 'middle',
      strokeColor: '#ffffff',
    },
  })

  if (!branches.length) return { elements: nodes, branchCount: 0 }

  // Répartition équilibrée droite / gauche
  const rightCount = Math.ceil(branches.length / 2)
  const sides: { list: Laid[]; dir: 1 | -1 }[] = [
    { list: branches.slice(0, rightCount), dir: 1 },
    { list: branches.slice(rightCount), dir: -1 },
  ]

  let colorIndex = 0

  const placeNode = (
    laid: Laid,
    centerY: number,
    dir: 1 | -1,
    parentId: string,
    parentEdgeX: number,
    color: { bg: string; stroke: string; soft: string }
  ) => {
    const cfg = LEVEL[Math.min(laid.depth, LEVEL.length - 1)]
    const x = dir === 1 ? parentEdgeX + H_GAP : parentEdgeX - H_GAP - cfg.width
    const y = centerY - laid.height / 2
    const id = `${parentId}_${laid.depth}_${Math.round(centerY)}_${nodes.length}`
    const isBranch = laid.depth === 1

    nodes.push({
      type: 'rectangle',
      id,
      x,
      y,
      width: cfg.width,
      height: laid.height,
      backgroundColor: isBranch ? color.bg : color.soft,
      strokeColor: color.stroke,
      fillStyle: 'solid',
      roughness: 0,
      strokeWidth: isBranch ? 2 : 1,
      roundness: { type: 3 },
      label: {
        text: laid.node.note ? `${laid.node.title}\n${laid.node.note}` : (laid.node.title ?? ''),
        fontSize: cfg.fontSize,
        fontFamily: 2,
        textAlign: 'center',
        verticalAlign: 'middle',
      },
    })

    connectors.push({
      type: 'arrow',
      x: parentEdgeX,
      y: centerY,
      strokeColor: color.stroke,
      strokeWidth: isBranch ? 2.5 : 1.5,
      roughness: 0,
      roundness: { type: 2 },
      endArrowhead: null,
      start: { id: parentId },
      end: { id },
    })

    // Enfants
    if (laid.children.length) {
      const totalHeight =
        laid.children.reduce((s, c) => s + c.subtreeHeight, 0) + (laid.children.length - 1) * V_GAP
      let cursor = centerY - totalHeight / 2
      const edgeX = dir === 1 ? x + cfg.width : x
      for (const child of laid.children) {
        const childCenter = cursor + child.subtreeHeight / 2
        placeNode(child, childCenter, dir, id, edgeX, color)
        cursor += child.subtreeHeight + V_GAP
      }
    }
  }

  for (const side of sides) {
    if (!side.list.length) continue
    const total =
      side.list.reduce((s, b) => s + b.subtreeHeight, 0) + (side.list.length - 1) * (V_GAP * 2)
    let cursor = cy - total / 2
    for (const branch of side.list) {
      const color = BRANCH_COLORS[colorIndex % BRANCH_COLORS.length]
      colorIndex += 1
      const centerY = cursor + branch.subtreeHeight / 2
      placeNode(
        branch,
        centerY,
        side.dir,
        rootId,
        side.dir === 1 ? cx + rootCfg.width / 2 : cx - rootCfg.width / 2,
        color
      )
      cursor += branch.subtreeHeight + V_GAP * 2
    }
  }

  return { elements: [...nodes, ...connectors], branchCount: branches.length }
}

/** Extrait le premier objet JSON valide d'une réponse IA (tolère le markdown). */
export function parseMindMapJson(raw: string): MindMapAiTree {
  const cleaned = raw.replace(/```json|```/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  const parsed = JSON.parse(candidate) as MindMapAiTree & { root?: string; nodes?: unknown }
  if (!parsed.central && typeof parsed.root === 'string') parsed.central = parsed.root
  if (!parsed.branches && Array.isArray(parsed.nodes)) {
    parsed.branches = parsed.nodes as MindMapAiNode[]
  }
  return parsed
}
