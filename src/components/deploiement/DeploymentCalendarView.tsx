import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Etablissement } from '@/hooks/crm/useEtablissements'

interface DeploymentCalendarViewProps {
  etablissements: Etablissement[]
}

export function DeploymentCalendarView({ etablissements }: DeploymentCalendarViewProps) {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Grouper les événements par jour
    const eventsByDay = new Map<string, Etablissement[]>()

    etablissements.forEach(etablissement => {
      if (etablissement.date_signature) {
        const signatureDate = new Date(etablissement.date_signature)
        if (isSameMonth(signatureDate, currentMonth)) {
          const dayKey = format(signatureDate, 'yyyy-MM-dd')
          const existing = eventsByDay.get(dayKey) || []
          eventsByDay.set(dayKey, [...existing, etablissement])
        }
      }
    })

    return { daysInMonth, eventsByDay }
  }, [currentMonth, etablissements])

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'Contractuel': return 'bg-blue-500/20 border-blue-500'
      case 'Conformité': return 'bg-yellow-500/20 border-yellow-500'
      case 'Déploiement': return 'bg-purple-500/20 border-purple-500'
      case 'Formation': return 'bg-green-500/20 border-green-500'
      case 'Go-Live': return 'bg-emerald-500/20 border-emerald-500'
      default: return 'bg-gray-500/20 border-gray-500'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Aujourd'hui
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* En-tête des jours de la semaine */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Grille du calendrier */}
        <div className="grid grid-cols-7 gap-2">
          {calendarData.daysInMonth.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const events = calendarData.eventsByDay.get(dayKey) || []
            const isToday = isSameDay(day, new Date())

            return (
              <div
                key={dayKey}
                className={`min-h-[100px] border rounded-lg p-2 ${
                  isToday ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="text-sm font-medium mb-1">
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-1">
                  {events.slice(0, 3).map(etablissement => (
                    <button
                      key={etablissement.id}
                      onClick={() => navigate(`/etablissements/${etablissement.id}`)}
                      className={`w-full text-left p-1.5 rounded border text-xs hover:shadow-sm transition-shadow ${getStatutColor(etablissement.statut)}`}
                    >
                      <p className="font-medium truncate">{etablissement.nom}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {etablissement.statut}
                      </p>
                    </button>
                  ))}
                  
                  {events.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{events.length - 3} autres
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Légende */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className="font-medium">Légende:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500" />
              <span>Contractuel</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500" />
              <span>Conformité</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500" />
              <span>Déploiement</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500" />
              <span>Formation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500" />
              <span>Go-Live</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
