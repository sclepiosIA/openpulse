import { AlertTriangle } from 'lucide-react'

interface TutorielWarningProps {
  content: string
}

export function TutorielWarning({ content }: TutorielWarningProps) {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-destructive mb-1">Attention</p>
        <p className="text-sm text-foreground">{content}</p>
      </div>
    </div>
  )
}
