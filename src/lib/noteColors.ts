import type { NoteColor } from '@/types/supabase-extensions'

export const NOTE_COLORS: NoteColor[] = [
  'yellow',
  'pink',
  'blue',
  'green',
  'orange',
  'purple',
  'gray',
]

export const NOTE_COLOR_LABELS: Record<NoteColor, string> = {
  yellow: 'Jaune',
  pink: 'Rose',
  blue: 'Bleu',
  green: 'Vert',
  orange: 'Orange',
  purple: 'Violet',
  gray: 'Gris',
}

interface NoteColorTokens {
  /** Fond principal du post-it (papier) */
  paper: string
  /** Fond légèrement plus foncé (ombre haute du post-it) */
  paperEdge: string
  /** Bandeau/tab foncé (colle en haut du post-it) */
  band: string
  /** Couleur d'accent utilisée sur les onglets actifs */
  accent: string
  /** Couleur de texte lisible sur le papier */
  ink: string
  /** Fond pour l'onglet inactif (teinte discrète) */
  tabIdle: string
  /** Fond pour l'onglet actif */
  tabActive: string
  /** Couleur de texte sur onglet actif */
  tabActiveText: string
  /** Pastille de couleur (color swatch) */
  swatch: string
}

export const NOTE_COLOR_TOKENS: Record<NoteColor, NoteColorTokens> = {
  yellow: {
    paper: '#FEF9C3',
    paperEdge: '#FDE68A',
    band: '#EAB308',
    accent: '#CA8A04',
    ink: '#713F12',
    tabIdle: '#FEF3C7',
    tabActive: '#FDE68A',
    tabActiveText: '#713F12',
    swatch: '#FACC15',
  },
  pink: {
    paper: '#FCE7F3',
    paperEdge: '#FBCFE8',
    band: '#EC4899',
    accent: '#DB2777',
    ink: '#831843',
    tabIdle: '#FCE7F3',
    tabActive: '#FBCFE8',
    tabActiveText: '#831843',
    swatch: '#F472B6',
  },
  blue: {
    paper: '#DBEAFE',
    paperEdge: '#BFDBFE',
    band: '#3B82F6',
    accent: '#2563EB',
    ink: '#1E3A8A',
    tabIdle: '#DBEAFE',
    tabActive: '#BFDBFE',
    tabActiveText: '#1E3A8A',
    swatch: '#60A5FA',
  },
  green: {
    paper: '#DCFCE7',
    paperEdge: '#BBF7D0',
    band: '#22C55E',
    accent: '#16A34A',
    ink: '#14532D',
    tabIdle: '#DCFCE7',
    tabActive: '#BBF7D0',
    tabActiveText: '#14532D',
    swatch: '#4ADE80',
  },
  orange: {
    paper: '#FFEDD5',
    paperEdge: '#FED7AA',
    band: '#F97316',
    accent: '#EA580C',
    ink: '#7C2D12',
    tabIdle: '#FFEDD5',
    tabActive: '#FED7AA',
    tabActiveText: '#7C2D12',
    swatch: '#FB923C',
  },
  purple: {
    paper: '#EDE9FE',
    paperEdge: '#DDD6FE',
    band: '#8B5CF6',
    accent: '#7C3AED',
    ink: '#4C1D95',
    tabIdle: '#EDE9FE',
    tabActive: '#DDD6FE',
    tabActiveText: '#4C1D95',
    swatch: '#A78BFA',
  },
  gray: {
    paper: '#F1F5F9',
    paperEdge: '#E2E8F0',
    band: '#64748B',
    accent: '#475569',
    ink: '#1E293B',
    tabIdle: '#F1F5F9',
    tabActive: '#E2E8F0',
    tabActiveText: '#1E293B',
    swatch: '#94A3B8',
  },
}

export function getNoteColorTokens(color: NoteColor | null | undefined): NoteColorTokens {
  return NOTE_COLOR_TOKENS[color ?? 'yellow'] ?? NOTE_COLOR_TOKENS.yellow
}
