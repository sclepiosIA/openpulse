import { useCompanyInfo } from "@/hooks/shared/useAppConfig";

interface GanttExportFooterProps {
  pageNumber?: number
  totalPages?: number
}

// Fonction pour générer le HTML statique du footer (utilisé dans les exports PDF/print)
// Accepte les infos société en paramètre pour éviter le hook dans un contexte non-React
export function generateGanttExportFooterHTML(
  props: GanttExportFooterProps,
  companyInfo?: { name?: string; email?: string; phone?: string }
): string {
  const currentYear = new Date().getFullYear()
  const name = companyInfo?.name || 'OpenPulse'
  const email = companyInfo?.email || ''
  const phone = companyInfo?.phone || ''

  return `
    <div style="
      width: 100%;
      padding: 1rem 2rem;
      margin-top: 1.5rem;
      background: rgba(0, 0, 0, 0.02);
      border-top: 2px solid hsl(35, 95%, 60%);
    ">
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.875rem;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 1rem;
          color: hsl(220, 9%, 46%);
        ">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2L8 14M2 8L14 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="8" cy="8" r="6" stroke="hsl(35, 95%, 60%)" stroke-width="1"/>
            </svg>
            <span style="font-weight: 600;">${name}</span>
          </div>
          ${email ? `<span>•</span><span>${email}</span>` : ''}
          ${phone ? `<span>•</span><span>${phone}</span>` : ''}
        </div>

        <div style="
          display: flex;
          align-items: center;
          gap: 1rem;
          color: hsl(220, 9%, 46%);
        ">
          <span style="font-size: 0.75rem; font-weight: 500;">
            Document confidentiel - Tous droits réservés © ${currentYear}
          </span>
          ${props.pageNumber && props.totalPages ? `
            <span>•</span>
            <span style="font-weight: 600;">
              Page ${props.pageNumber} / ${props.totalPages}
            </span>
          ` : ''}
        </div>
      </div>
    </div>
  `
}

export function GanttExportFooter({ pageNumber, totalPages }: GanttExportFooterProps) {
  const { data: companyInfo } = useCompanyInfo()
  
  const name = companyInfo?.name || 'OpenPulse'
  const email = companyInfo?.email || ''
  const phone = companyInfo?.phone || ''

  return (
    <div className="w-full px-8 py-4 mt-6 bg-muted/10 border-t-2 border-primary/20">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2L8 14M2 8L14 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="8" r="6" stroke="hsl(35 95% 60%)" strokeWidth="1"/>
            </svg>
            <span className="font-semibold">{name}</span>
          </div>
          {email && (
            <>
              <span>•</span>
              <span>{email}</span>
            </>
          )}
          {phone && (
            <>
              <span>•</span>
              <span>{phone}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="text-xs font-medium">
            Document confidentiel - Tous droits réservés © {new Date().getFullYear()}
          </span>
          {pageNumber && totalPages && (
            <>
              <span>•</span>
              <span className="font-semibold">
                Page {pageNumber} / {totalPages}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
