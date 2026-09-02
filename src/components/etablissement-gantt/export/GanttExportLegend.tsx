import {
  CheckCircle,
  Clock,
  AlertCircle,
  Circle,
  FileText,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Allow only safe CSS color tokens (hex, rgb/rgba, hsl/hsla, named colors)
function safeCssColor(value: string | null | undefined): string {
  const fallback = '#6B7280'
  if (!value) return fallback
  const v = String(value).trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,\s%/-]+\)$/i.test(v)) return v
  if (/^[a-zA-Z]{1,32}$/.test(v)) return v
  return fallback
}

interface CategoryInfo {
  id: string
  nom: string
  couleur: string | null
}

interface GanttExportLegendProps {
  categories: CategoryInfo[]
  stats: {
    total: number
    parStatut: {
      'A faire': number
      'En cours': number
      Bloqué: number
      Terminé: number
    }
    enRetard: number
  }
}

// Fonction pour générer le HTML statique de la légende
export function generateGanttExportLegendHTML(props: GanttExportLegendProps): string {
  const { categories, stats } = props

  const categoriesHTML = categories
    .map(
      (cat) => `
    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
      <div style="
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 0.125rem;
        background: ${safeCssColor(cat.couleur)};
        border: 1px solid rgba(0, 0, 0, 0.1);
      "></div>
      <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">${escapeHtml(cat.nom)}</span>
    </div>
  `
    )
    .join('')

  return `
    <div style="
      width: 100%;
      padding: 1.5rem 2rem;
      margin-top: 1.5rem;
      background: white;
      border: 2px solid rgba(16, 61, 107, 0.2);
      border-radius: 0.5rem;
    ">
      <h2 style="
        font-size: 1.25rem;
        font-weight: 700;
        color: hsl(207, 90%, 25%);
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid hsl(35, 95%, 60%);
      ">
        Légende & Informations
      </h2>
      
      <div style="
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
      ">
        <!-- Statuts -->
        <div>
          <h3 style="
            font-size: 1rem;
            font-weight: 700;
            color: hsl(222, 47%, 11%);
            margin-bottom: 0.75rem;
          ">Statuts des tâches</h3>
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="hsl(220, 9%, 46%)" stroke-width="1.5"/>
              </svg>
              <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">À faire</span>
              <span style="margin-left: auto; font-size: 0.875rem; font-weight: 700; color: hsl(220, 9%, 46%);">
                ${stats.parStatut['A faire']}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#3B82F6" stroke-width="1.5"/>
                <path d="M8 5v3l2 2" stroke="#3B82F6" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">En cours</span>
              <span style="margin-left: auto; font-size: 0.875rem; font-weight: 700; color: #3B82F6;">
                ${stats.parStatut['En cours']}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#EF4444" stroke-width="1.5"/>
                <circle cx="8" cy="8" r="1.5" fill="#EF4444"/>
              </svg>
              <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">Bloqué</span>
              <span style="margin-left: auto; font-size: 0.875rem; font-weight: 700; color: #EF4444;">
                ${stats.parStatut['Bloqué']}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#10B981" stroke-width="1.5"/>
                <path d="M5 8l2 2 4-4" stroke="#10B981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">Terminé</span>
              <span style="margin-left: auto; font-size: 0.875rem; font-weight: 700; color: #10B981;">
                ${stats.parStatut['Terminé']}
              </span>
            </div>
          </div>
        </div>

        <!-- Priorités et Indicateurs -->
        <div>
          <h3 style="
            font-size: 1rem;
            font-weight: 700;
            color: hsl(222, 47%, 11%);
            margin-bottom: 0.75rem;
          ">Niveaux de priorité</h3>
          <div style="margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <div style="width: 0.75rem; height: 0.75rem; background: #EF4444; border-radius: 9999px;"></div>
              <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">Haute</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <div style="width: 0.75rem; height: 0.75rem; background: #F59E0B; border-radius: 9999px;"></div>
              <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">Moyenne</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <div style="width: 0.75rem; height: 0.75rem; background: #10B981; border-radius: 9999px;"></div>
              <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">Basse</span>
            </div>
          </div>

          <div style="padding-top: 0.75rem; border-top: 1px solid hsl(214, 32%, 91%);">
            <h3 style="
              font-size: 1rem;
              font-weight: 700;
              color: hsl(222, 47%, 11%);
              margin-bottom: 0.75rem;
            ">Indicateurs</h3>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="4" width="10" height="10" rx="1" stroke="hsl(207, 90%, 25%)" stroke-width="1.5"/>
                  <path d="M6 4V2M10 4V2" stroke="hsl(207, 90%, 25%)" stroke-width="1.5"/>
                </svg>
                <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">Avec documents</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4z" stroke="hsl(207, 90%, 25%)" stroke-width="1.5"/>
                  <path d="M5 10l-2 2M11 10l2 2" stroke="hsl(207, 90%, 25%)" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">Avec commentaires</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L8 9M8 12v1" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
                  <path d="M3 3L13 13" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span style="font-size: 0.875rem; font-weight: 500; color: hsl(222, 47%, 11%);">En retard</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Catégories et Total -->
        <div>
          <h3 style="
            font-size: 1rem;
            font-weight: 700;
            color: hsl(222, 47%, 11%);
            margin-bottom: 0.75rem;
          ">Catégories</h3>
          <div style="max-height: 12rem; overflow-y: auto;">
            ${categoriesHTML}
          </div>

          <div style="
            margin-top: 1rem;
            padding-top: 0.75rem;
            border-top: 1px solid hsl(214, 32%, 91%);
          ">
            <div style="
              background: rgba(16, 61, 107, 0.05);
              border-radius: 0.5rem;
              padding: 0.75rem;
            ">
              <div style="
                font-size: 0.875rem;
                color: hsl(220, 9%, 46%);
                margin-bottom: 0.25rem;
              ">Total des tâches</div>
              <div style="
                font-size: 1.5rem;
                font-weight: 700;
                color: hsl(207, 90%, 25%);
              ">${stats.total}</div>
              ${
                stats.enRetard > 0
                  ? `
                <div style="
                  font-size: 0.75rem;
                  color: #EF4444;
                  font-weight: 600;
                  margin-top: 0.25rem;
                ">
                  ${stats.enRetard} tâche${stats.enRetard > 1 ? 's' : ''} en retard
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

export function GanttExportLegend({ categories, stats }: GanttExportLegendProps) {
  return (
    <div className="w-full px-8 py-6 mt-6 bg-card border-2 border-primary/20 rounded-lg">
      <h2 className="text-xl font-bold text-primary mb-4 pb-2 border-b-2 border-accent">
        Légende & Informations
      </h2>

      <div className="grid grid-cols-3 gap-6">
        {/* Statuts */}
        <div>
          <h3 className="text-base font-bold text-foreground mb-3">Statuts des tâches</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">À faire</span>
              <span className="ml-auto text-sm font-bold text-muted-foreground">
                {stats.parStatut['A faire']}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#3280DD]" />
              <span className="text-sm font-medium text-foreground">En cours</span>
              <span className="ml-auto text-sm font-bold text-[#3280DD]">
                {stats.parStatut['En cours']}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#B8481A]" />
              <span className="text-sm font-medium text-foreground">Bloqué</span>
              <span className="ml-auto text-sm font-bold text-[#B8481A]">
                {stats.parStatut['Bloqué']}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-medium text-foreground">Terminé</span>
              <span className="ml-auto text-sm font-bold text-[#10B981]">
                {stats.parStatut['Terminé']}
              </span>
            </div>
          </div>
        </div>

        {/* Priorités */}
        <div>
          <h3 className="text-base font-bold text-foreground mb-3">Niveaux de priorité</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#B8481A]"></div>
              <span className="text-sm font-medium text-foreground">Haute</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#CB5A1A]"></div>
              <span className="text-sm font-medium text-foreground">Moyenne</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
              <span className="text-sm font-medium text-foreground">Basse</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <h3 className="text-base font-bold text-foreground mb-3">Indicateurs</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Avec documents</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Avec commentaires</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B8481A]" />
                <span className="text-sm font-medium text-foreground">En retard</span>
              </div>
            </div>
          </div>
        </div>

        {/* Catégories */}
        <div>
          <h3 className="text-base font-bold text-foreground mb-3">Catégories</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm border border-border"
                  style={{
                    backgroundColor: cat.couleur || '#6B7280',
                  }}
                ></div>
                <span className="text-sm font-medium text-foreground truncate">{cat.nom}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-sm text-muted-foreground mb-1">Total des tâches</div>
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
              {stats.enRetard > 0 && (
                <div className="text-xs text-destructive font-semibold mt-1">
                  {stats.enRetard} tâche{stats.enRetard > 1 ? 's' : ''} en retard
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
