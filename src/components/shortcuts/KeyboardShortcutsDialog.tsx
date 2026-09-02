import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

interface Shortcut {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  category: string
  shortcuts: Shortcut[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: 'Navigation',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Ouvrir la recherche globale' },
      { keys: ['Ctrl', 'K'], description: 'Ouvrir la recherche globale (Windows/Linux)' },
      { keys: ['?'], description: 'Afficher les raccourcis clavier' },
      { keys: ['Esc'], description: 'Fermer les boîtes de dialogue' },
    ],
  },
  {
    category: 'Tableaux',
    shortcuts: [
      { keys: ['Entrée'], description: 'Valider une édition inline' },
      { keys: ['Esc'], description: 'Annuler une édition inline' },
      { keys: ['Tab'], description: 'Cellule suivante' },
      { keys: ['↑', '↓'], description: 'Naviguer dans les résultats' },
    ],
  },
  {
    category: 'Sélection',
    shortcuts: [
      { keys: ['Espace'], description: 'Sélectionner / désélectionner une ligne' },
      { keys: ['⌘', 'A'], description: 'Tout sélectionner' },
    ],
  },
  {
    category: 'Email',
    shortcuts: [
      { keys: ['R'], description: 'Répondre' },
      { keys: ['Maj', 'R'], description: 'Répondre à tous' },
      { keys: ['F'], description: 'Transférer' },
      { keys: ['E'], description: 'Archiver / marquer traité' },
    ],
  },
]

function isInTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

/**
 * Twenty CRM-inspired global keyboard shortcuts cheatsheet.
 * Press `?` anywhere (outside text fields) to open.
 */
export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // `?` requires Shift+/ on most layouts
      if (e.key === '?' && !isInTextField(e.target)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Raccourcis clavier
          </DialogTitle>
          <DialogDescription>
            Appuyez sur <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border">?</kbd> à
            tout moment pour rouvrir ce panneau.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.category}
              </h3>
              <ul className="space-y-2">
                {group.shortcuts.map((sc, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground/80">{sc.description}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {sc.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border min-w-[1.5rem] text-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
