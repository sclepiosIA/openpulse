import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  actions?: ReactNode
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 pt-6 pb-4 border-b border-border">
      <h1 className="text-2xl sm:text-[34px] sm:leading-[38px] font-light text-foreground truncate">
        {title}
      </h1>
      {actions && <div className="flex items-center gap-2 flex-wrap sm:pt-1">{actions}</div>}
    </div>
  )
}
