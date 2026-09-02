import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Bell,
  Volume2,
  Palette,
  Image as ImageIcon,
  Check,
  Type,
  Rows3,
  Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  isPulseSoundEnabled,
  setPulseSoundEnabled,
  isPulseDesktopEnabled,
  setPulseDesktopEnabled,
  getPulseTheme,
  setPulseTheme,
  PULSE_BUBBLE_PRESETS,
  PULSE_BG_PRESETS,
  type PulseFontSize,
  type PulseDensity,
  type PulseBubbleShape,
} from '@/lib/pulsePreferences'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
}

const FONT_OPTIONS: { id: PulseFontSize; label: string; sample: string }[] = [
  { id: 'sm', label: 'Petit', sample: '13' },
  { id: 'md', label: 'Normal', sample: '14' },
  { id: 'lg', label: 'Grand', sample: '16' },
  { id: 'xl', label: 'Très grand', sample: '18' },
]
const DENSITY_OPTIONS: { id: PulseDensity; label: string }[] = [
  { id: 'compact', label: 'Compact' },
  { id: 'cozy', label: 'Confortable' },
  { id: 'spacious', label: 'Spacieux' },
]
const SHAPE_OPTIONS: { id: PulseBubbleShape; label: string; radius: string }[] = [
  { id: 'square', label: 'Angulaire', radius: '4px' },
  { id: 'rounded', label: 'Arrondi', radius: '12px' },
  { id: 'bubble', label: 'Bulle', radius: '20px' },
  { id: 'pill', label: 'Pilule', radius: '28px' },
]

export function PulsePreferencesDialog({ open, onOpenChange }: Props) {
  const [sound, setSound] = useState(isPulseSoundEnabled())
  const [desktop, setDesktop] = useState(isPulseDesktopEnabled())
  const [theme, setThemeState] = useState(getPulseTheme())

  useEffect(() => {
    if (open) {
      setSound(isPulseSoundEnabled())
      setDesktop(isPulseDesktopEnabled())
      setThemeState(getPulseTheme())
    }
  }, [open])

  const handleSound = (v: boolean) => {
    setSound(v)
    setPulseSoundEnabled(v)
  }
  const handleDesktop = (v: boolean) => {
    setDesktop(v)
    setPulseDesktopEnabled(v)
    if (v && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const update = (patch: Partial<typeof theme>) => {
    setPulseTheme(patch)
    setThemeState((prev) => ({ ...prev, ...patch }))
  }

  const activeBubble =
    PULSE_BUBBLE_PRESETS.find((b) => b.id === theme.bubbleId) ?? PULSE_BUBBLE_PRESETS[0]
  const activeBg = PULSE_BG_PRESETS.find((b) => b.id === theme.bgId) ?? PULSE_BG_PRESETS[0]
  const activeShape = SHAPE_OPTIONS.find((s) => s.id === theme.shape) ?? SHAPE_OPTIONS[2]
  const activeFont = FONT_OPTIONS.find((f) => f.id === theme.fontSize) ?? FONT_OPTIONS[1]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Préférences Pulse</DialogTitle>
          <DialogDescription>
            Personnalisez notifications et apparence de votre messagerie.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="h-4 w-4 mr-2" />
              Apparence
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="pulse-sound" className="flex items-center gap-2 cursor-pointer">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <span>Son de notification</span>
              </Label>
              <Switch id="pulse-sound" checked={sound} onCheckedChange={handleSound} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="pulse-desktop" className="flex items-center gap-2 cursor-pointer">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span>Notifications navigateur</span>
              </Label>
              <Switch id="pulse-desktop" checked={desktop} onCheckedChange={handleDesktop} />
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-5 py-2">
            {/* Couleur de bulle */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Palette className="h-4 w-4 text-muted-foreground" /> Couleur de mes bulles
              </Label>
              <div className="grid grid-cols-7 gap-2">
                {PULSE_BUBBLE_PRESETS.map((p) => {
                  const active = theme.bubbleId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => update({ bubbleId: p.id })}
                      className={cn(
                        'relative h-10 w-10 rounded-full border-2 transition-all hover:scale-110',
                        active
                          ? 'border-foreground ring-2 ring-offset-2 ring-foreground/30'
                          : 'border-border/50'
                      )}
                      style={{ background: p.bg }}
                      aria-label={p.label}
                      title={p.label}
                    >
                      {active && (
                        <Check
                          className="h-4 w-4 absolute inset-0 m-auto"
                          style={{ color: p.fg }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Fond */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Fond de conversation
              </Label>
              <div className="grid grid-cols-5 gap-2">
                {PULSE_BG_PRESETS.map((p) => {
                  const active = theme.bgId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => update({ bgId: p.id })}
                      className={cn(
                        'relative h-14 rounded-lg border-2 overflow-hidden transition-all hover:scale-[1.03] flex items-end justify-center',
                        active
                          ? 'border-primary ring-2 ring-offset-2 ring-primary/30'
                          : 'border-border'
                      )}
                      style={{ background: p.bg || 'hsl(var(--muted))' }}
                      title={p.label}
                    >
                      <span className="text-[10px] font-medium bg-background/85 backdrop-blur px-1.5 py-0.5 rounded-sm mb-1">
                        {p.label}
                      </span>
                      {active && (
                        <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Taille du texte */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Type className="h-4 w-4 text-muted-foreground" /> Taille du texte
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {FONT_OPTIONS.map((f) => {
                  const active = theme.fontSize === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => update({ fontSize: f.id })}
                      className={cn(
                        'h-12 rounded-lg border-2 flex flex-col items-center justify-center transition-all hover:bg-muted',
                        active ? 'border-primary bg-primary/5' : 'border-border'
                      )}
                    >
                      <span className="font-semibold" style={{ fontSize: f.sample + 'px' }}>
                        Aa
                      </span>
                      <span className="text-[10px] text-muted-foreground">{f.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Densité */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Rows3 className="h-4 w-4 text-muted-foreground" /> Densité des messages
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {DENSITY_OPTIONS.map((d) => {
                  const active = theme.density === d.id
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => update({ density: d.id })}
                      className={cn(
                        'h-10 rounded-lg border-2 text-sm transition-all hover:bg-muted',
                        active ? 'border-primary bg-primary/5 font-medium' : 'border-border'
                      )}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Forme des bulles */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Square className="h-4 w-4 text-muted-foreground" /> Forme des bulles
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {SHAPE_OPTIONS.map((s) => {
                  const active = theme.shape === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => update({ shape: s.id })}
                      className={cn(
                        'h-12 border-2 flex flex-col items-center justify-center transition-all hover:bg-muted p-1',
                        active ? 'border-primary bg-primary/5' : 'border-border'
                      )}
                      style={{ borderRadius: '8px' }}
                    >
                      <span
                        className="block w-8 h-4 bg-muted-foreground/40"
                        style={{ borderRadius: s.radius }}
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5">{s.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Aperçu */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Aperçu</Label>
              <div
                className="rounded-lg border p-4 space-y-2"
                style={{ background: activeBg.bg || 'hsl(var(--muted) / 0.3)' }}
              >
                <div className="flex justify-start">
                  <span
                    className="inline-block px-3 py-2 bg-muted"
                    style={{
                      fontSize: activeFont.sample + 'px',
                      borderRadius: activeShape.radius,
                      borderBottomLeftRadius: `calc(${activeShape.radius} * 0.25)`,
                    }}
                  >
                    Salut 👋 ça te plaît ?
                  </span>
                </div>
                <div className="flex justify-end">
                  <span
                    className="inline-block px-3 py-2"
                    style={{
                      fontSize: activeFont.sample + 'px',
                      background: activeBubble.bg,
                      color: activeBubble.fg,
                      borderRadius: activeShape.radius,
                      borderBottomRightRadius: `calc(${activeShape.radius} * 0.25)`,
                    }}
                  >
                    Oui, c'est top ✨
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
