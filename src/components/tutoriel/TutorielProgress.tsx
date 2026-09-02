import { Clock, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface TutorielProgressProps {
  estimatedTime: string
  level: 'debutant' | 'intermediaire' | 'avance'
  sectionsCount: number
}

const levelLabels = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé'
}

const levelColors = {
  debutant: 'bg-green-500/10 text-green-600 border-green-500/20',
  intermediaire: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  avance: 'bg-red-500/10 text-red-600 border-red-500/20'
}

export function TutorielProgress({ estimatedTime, level, sectionsCount }: TutorielProgressProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="outline" className={levelColors[level]}>
        {levelLabels[level]}
      </Badge>
      
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>{estimatedTime}</span>
      </div>
      
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>{sectionsCount} section{sectionsCount > 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}
