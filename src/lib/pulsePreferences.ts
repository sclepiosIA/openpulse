/**
 * Pulse user preferences (notifications + apparence) — local persistence.
 */
const SOUND_KEY = 'pulse.notifications.sound'
const DESKTOP_KEY = 'pulse.notifications.desktop'
const THEME_KEY = 'pulse.theme.v2'
export const PULSE_THEME_EVENT = 'pulse:theme-changed'

export const isPulseSoundEnabled = (): boolean => {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(SOUND_KEY) !== '0'
}
export const setPulseSoundEnabled = (enabled: boolean) => {
  localStorage.setItem(SOUND_KEY, enabled ? '1' : '0')
}
export const isPulseDesktopEnabled = (): boolean => {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(DESKTOP_KEY) !== '0'
}
export const setPulseDesktopEnabled = (enabled: boolean) => {
  localStorage.setItem(DESKTOP_KEY, enabled ? '1' : '0')
}

// ─────────── Apparence ───────────

export interface PulseBubblePreset {
  id: string
  label: string
  bg: string
  fg: string
}
export interface PulseBackgroundPreset {
  id: string
  label: string
  bg: string
}

export const PULSE_BUBBLE_PRESETS: PulseBubblePreset[] = [
  {
    id: 'default',
    label: 'OpenPulse',
    bg: 'hsl(var(--primary))',
    fg: 'hsl(var(--primary-foreground))',
  },
  { id: 'blue', label: 'Bleu', bg: '#2563eb', fg: '#ffffff' },
  { id: 'indigo', label: 'Indigo', bg: '#4f46e5', fg: '#ffffff' },
  { id: 'violet', label: 'Violet', bg: '#7c3aed', fg: '#ffffff' },
  { id: 'pink', label: 'Rose', bg: '#db2777', fg: '#ffffff' },
  { id: 'red', label: 'Rouge', bg: '#dc2626', fg: '#ffffff' },
  { id: 'orange', label: 'Orange', bg: '#ea580c', fg: '#ffffff' },
  { id: 'amber', label: 'Ambre', bg: '#f59e0b', fg: '#1f1300' },
  { id: 'emerald', label: 'Émeraude', bg: '#059669', fg: '#ffffff' },
  { id: 'teal', label: 'Teal', bg: '#0d9488', fg: '#ffffff' },
  { id: 'cyan', label: 'Cyan', bg: '#0891b2', fg: '#ffffff' },
  { id: 'slate', label: 'Ardoise', bg: '#334155', fg: '#ffffff' },
  { id: 'black', label: 'Noir', bg: '#0f172a', fg: '#ffffff' },
]

export const PULSE_BG_PRESETS: PulseBackgroundPreset[] = [
  { id: 'default', label: 'Par défaut', bg: '' },
  { id: 'paper', label: 'Papier', bg: '#faf7f2' },
  { id: 'mist', label: 'Brume', bg: '#f1f5f9' },
  { id: 'sky', label: 'Ciel', bg: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)' },
  { id: 'mint', label: 'Menthe', bg: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)' },
  { id: 'peach', label: 'Pêche', bg: 'linear-gradient(180deg, #fff7ed 0%, #ffffff 100%)' },
  { id: 'lavender', label: 'Lavande', bg: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)' },
  { id: 'rose', label: 'Rosé', bg: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)' },
  { id: 'sunset', label: 'Coucher', bg: 'linear-gradient(160deg, #ffedd5 0%, #fce7f3 100%)' },
  { id: 'ocean', label: 'Océan', bg: 'linear-gradient(180deg, #cffafe 0%, #dbeafe 100%)' },
  { id: 'forest', label: 'Forêt', bg: 'linear-gradient(180deg, #d1fae5 0%, #ecfccb 100%)' },
  { id: 'night', label: 'Nuit', bg: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' },
  { id: 'graphite', label: 'Graphite', bg: 'linear-gradient(180deg, #1f2937 0%, #111827 100%)' },
]

export type PulseFontSize = 'sm' | 'md' | 'lg' | 'xl'
export type PulseDensity = 'compact' | 'cozy' | 'spacious'
export type PulseBubbleShape = 'square' | 'rounded' | 'bubble' | 'pill'

const FONT_SIZE_MAP: Record<PulseFontSize, string> = {
  sm: '0.8125rem',
  md: '0.875rem',
  lg: '1rem',
  xl: '1.125rem',
}
const DENSITY_MAP: Record<PulseDensity, string> = {
  compact: '0.125rem',
  cozy: '0.25rem',
  spacious: '0.5rem',
}
const SHAPE_MAP: Record<PulseBubbleShape, string> = {
  square: '0.25rem',
  rounded: '0.75rem',
  bubble: '1.25rem',
  pill: '1.75rem',
}

export interface PulseTheme {
  bubbleId: string
  bgId: string
  fontSize: PulseFontSize
  density: PulseDensity
  shape: PulseBubbleShape
}

const DEFAULT_THEME: PulseTheme = {
  bubbleId: 'default',
  bgId: 'default',
  fontSize: 'md',
  density: 'cozy',
  shape: 'bubble',
}

export const getPulseTheme = (): PulseTheme => {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (!raw) return DEFAULT_THEME
    const parsed = JSON.parse(raw)
    return {
      bubbleId: typeof parsed?.bubbleId === 'string' ? parsed.bubbleId : DEFAULT_THEME.bubbleId,
      bgId: typeof parsed?.bgId === 'string' ? parsed.bgId : DEFAULT_THEME.bgId,
      fontSize: (['sm', 'md', 'lg', 'xl'] as const).includes(parsed?.fontSize)
        ? parsed.fontSize
        : DEFAULT_THEME.fontSize,
      density: (['compact', 'cozy', 'spacious'] as const).includes(parsed?.density)
        ? parsed.density
        : DEFAULT_THEME.density,
      shape: (['square', 'rounded', 'bubble', 'pill'] as const).includes(parsed?.shape)
        ? parsed.shape
        : DEFAULT_THEME.shape,
    }
  } catch {
    return DEFAULT_THEME
  }
}

export const setPulseTheme = (theme: Partial<PulseTheme>) => {
  const next = { ...getPulseTheme(), ...theme }
  localStorage.setItem(THEME_KEY, JSON.stringify(next))
  applyPulseTheme()
  window.dispatchEvent(new CustomEvent(PULSE_THEME_EVENT, { detail: next }))
}

export const applyPulseTheme = () => {
  if (typeof document === 'undefined') return
  const t = getPulseTheme()
  const bubble = PULSE_BUBBLE_PRESETS.find((p) => p.id === t.bubbleId) ?? PULSE_BUBBLE_PRESETS[0]
  const bg = PULSE_BG_PRESETS.find((p) => p.id === t.bgId) ?? PULSE_BG_PRESETS[0]
  const root = document.documentElement
  root.style.setProperty('--pulse-own-bubble', bubble.bg)
  root.style.setProperty('--pulse-own-bubble-fg', bubble.fg)
  root.style.setProperty('--pulse-messages-bg', bg.bg || 'transparent')
  root.style.setProperty('--pulse-msg-font-size', FONT_SIZE_MAP[t.fontSize])
  root.style.setProperty('--pulse-msg-gap', DENSITY_MAP[t.density])
  root.style.setProperty('--pulse-bubble-radius', SHAPE_MAP[t.shape])
  root.dataset.pulseBg = t.bgId
}
