import { Link } from 'react-router-dom'
import { 
  GraduationCap, 
  Clock, 
  BookOpen,
  Rocket,
  LayoutDashboard,
  Building2,
  Mail,
  Truck,
  Factory,
  Boxes,
  Euro,
  UserCog,
  Calendar,
  ChartGantt,
  Users,
  MapPin,
  BarChart3,
  Settings
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TutorielSearch } from '@/components/tutoriel/TutorielSearch'
import { TUTORIEL_CATEGORIES } from '@/types/tutoriel'
import { tutorielModules, getModuleById } from '@/lib/tutoriel-content'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  LayoutDashboard,
  Building2,
  Mail,
  Truck,
  Factory,
  Boxes,
  Euro,
  UserCog,
  Calendar,
  ChartGantt,
  Users,
  MapPin,
  BarChart3,
  Settings,
  GraduationCap,
}

const levelColors = {
  debutant: 'bg-green-500/10 text-green-600 border-green-500/20',
  intermediaire: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  avance: 'bg-red-500/10 text-red-600 border-red-500/20'
}

const levelLabels = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé'
}

import { UnifiedPageHeader } from "@/components/layout/UnifiedPageHeader";

export default function Tutoriels() {
  return (
    <div className="animate-fade-in">
      <UnifiedPageHeader
        title="Tutoriels"
        subtitle="Apprenez à utiliser OpenPulse avec nos guides complets"
        icon={GraduationCap}
      >
        {/* Search bar for mobile */}
        <div className="lg:hidden max-w-md">
          <TutorielSearch />
        </div>
      </UnifiedPageHeader>
      
      <div className="container max-w-6xl py-6 px-4 md:px-6">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{tutorielModules.length}</div>
            <p className="text-sm text-muted-foreground">Modules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {tutorielModules.reduce((acc, m) => acc + m.sections.length, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Sections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {tutorielModules.reduce((acc, m) => 
                acc + m.sections.reduce((a, s) => a + s.steps.length, 0), 0
              )}
            </div>
            <p className="text-sm text-muted-foreground">Étapes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              ~{tutorielModules.reduce((acc, m) => acc + parseInt(m.estimatedTime), 0)} min
            </div>
            <p className="text-sm text-muted-foreground">Temps total</p>
          </CardContent>
        </Card>
      </div>

      {/* Modules by category */}
      {TUTORIEL_CATEGORIES.map((category) => {
        const categoryModules = category.modules
          .map(id => getModuleById(id))
          .filter(Boolean)
        
        if (categoryModules.length === 0) return null

        return (
          <section key={category.id} className="mb-10">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{category.label}</h2>
              <p className="text-sm text-muted-foreground">{category.description}</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoryModules.map((module) => {
                if (!module) return null
                const IconComponent = iconMap[module.icon] || BookOpen
                
                return (
                  <Link 
                    key={module.id} 
                    to={`/tutoriels/${module.id}`}
                    className="group"
                  >
                    <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 group-hover:bg-accent/50">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <Badge 
                            variant="outline" 
                            className={levelColors[module.level]}
                          >
                            {levelLabels[module.level]}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg mt-3">{module.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {module.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{module.estimatedTime}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{module.sections.length} sections</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
      </div>
    </div>
  )
}
