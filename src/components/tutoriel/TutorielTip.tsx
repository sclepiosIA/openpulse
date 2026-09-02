import { Lightbulb } from 'lucide-react'

interface TutorielTipProps {
  content: string
}

export function TutorielTip({ content }: TutorielTipProps) {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
      <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-primary mb-1">Astuce</p>
        <p className="text-sm text-foreground">{content}</p>
      </div>
    </div>
  )
}
