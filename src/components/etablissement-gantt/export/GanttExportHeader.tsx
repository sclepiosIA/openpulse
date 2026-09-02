import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface GanttExportHeaderProps {
  etablissementNom: string
  dateDebut: Date
  dateFin: Date
  dateExport: Date
}

// Fonction pour générer le HTML statique du header
export function generateGanttExportHeaderHTML(props: GanttExportHeaderProps): string {
  const formattedDateDebut = format(props.dateDebut, 'dd MMM yyyy', { locale: fr })
  const formattedDateFin = format(props.dateFin, 'dd MMM yyyy', { locale: fr })
  const formattedDateExport = format(props.dateExport, 'dd MMMM yyyy', { locale: fr })

  return `
    <div style="
      width: 100%;
      padding: 1.5rem 2rem;
      margin-bottom: 1.5rem;
      background: hsl(20, 18%, 11%);
      border-bottom: 4px solid hsl(35, 95%, 60%);
    ">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="
              width: 4rem;
              height: 4rem;
              border-radius: 0.5rem;
              background: rgba(255, 255, 255, 0.1);
              display: flex;
              align-items: center;
              justify-content: center;
              backdrop-filter: blur(4px);
            ">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 8L24 40M8 24L40 24" stroke="white" stroke-width="3" stroke-linecap="round"/>
                <circle cx="24" cy="24" r="18" stroke="hsl(35, 95%, 60%)" stroke-width="2"/>
              </svg>
            </div>
            <div>
              <div style="
                font-size: 1.5rem;
                font-weight: 700;
                color: white;
                letter-spacing: -0.025em;
              ">
                OpenPulse
              </div>
              <div style="
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.8);
                font-weight: 500;
              ">
                Solutions Médicales Intelligentes
              </div>
            </div>
          </div>
        </div>

        <div style="text-align: right;">
          <div style="
            font-size: 0.875rem;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 500;
            margin-bottom: 0.25rem;
          ">
            Document généré le
          </div>
          <div style="
            font-size: 1.125rem;
            font-weight: 600;
            color: white;
          ">
            ${formattedDateExport}
          </div>
        </div>
      </div>

      <div style="
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
      ">
        <h1 style="
          font-size: 1.875rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.5rem;
        ">
          Planning de Déploiement
        </h1>
        <div style="
          display: flex;
          align-items: center;
          gap: 1.5rem;
          color: rgba(255, 255, 255, 0.9);
        ">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="
              width: 0.5rem;
              height: 0.5rem;
              border-radius: 9999px;
              background: hsl(35, 95%, 60%);
            "></div>
            <span style="font-size: 1.125rem; font-weight: 600;">${escapeHtml(props.etablissementNom)}</span>
          </div>
          <div style="font-size: 1rem;">
            Période : ${formattedDateDebut} - ${formattedDateFin}
          </div>
        </div>
      </div>
    </div>
  `
}

export function GanttExportHeader({
  etablissementNom,
  dateDebut,
  dateFin,
  dateExport,
}: GanttExportHeaderProps) {
  return (
    <div
      className="w-full px-8 py-6 mb-6 bg-primary"
      style={{
        background: 'hsl(20 18% 11%)',
        borderBottom: '4px solid hsl(35 95% 60%)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo OpenPulse */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg bg-card/10 flex items-center justify-center backdrop-blur-sm">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M24 8L24 40M8 24L40 24"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="24" cy="24" r="18" stroke="hsl(35 95% 60%)" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-white tracking-tight">OpenPulse</div>
              <div className="text-sm text-white/80 font-medium">
                Solutions Médicales Intelligentes
              </div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm text-white/70 font-medium mb-1">Document généré le</div>
          <div className="text-lg font-semibold text-white">
            {format(dateExport, 'dd MMMM yyyy', { locale: fr })}
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-white/20">
        <h1 className="text-3xl font-bold text-white mb-2">Planning de Déploiement</h1>
        <div className="flex items-center gap-6 text-white/90">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent"></div>
            <span className="text-lg font-semibold">{etablissementNom}</span>
          </div>
          <div className="text-base">
            Période : {format(dateDebut, 'dd MMM yyyy', { locale: fr })} -{' '}
            {format(dateFin, 'dd MMM yyyy', { locale: fr })}
          </div>
        </div>
      </div>
    </div>
  )
}
