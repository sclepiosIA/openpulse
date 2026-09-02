import { useParams, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TutorielLayout } from '@/components/tutoriel/TutorielLayout'
import { TutorielSection } from '@/components/tutoriel/TutorielSection'
import { TutorielProgress } from '@/components/tutoriel/TutorielProgress'
import { TutorielSearch } from '@/components/tutoriel/TutorielSearch'
import { getModuleById, tutorielModules } from '@/lib/tutoriel-content'
import { useTutorielProgress } from '@/hooks/knowledge/useTutorielProgress'

export default function TutorielModule() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const location = useLocation()
  const [currentSectionId, setCurrentSectionId] = useState<string>()
  
  const module = moduleId ? getModuleById(moduleId) : undefined
  
  // Hook de progression utilisateur
  const { 
    percentComplete, 
    isCompleted, 
    markSectionRead, 
    completedSections 
  } = useTutorielProgress(moduleId || '', module?.sections.length || 0)
  
  // Get previous and next modules for navigation
  const currentIndex = tutorielModules.findIndex(m => m.id === moduleId)
  const previousModule = currentIndex > 0 ? tutorielModules[currentIndex - 1] : undefined
  const nextModule = currentIndex < tutorielModules.length - 1 ? tutorielModules[currentIndex + 1] : undefined

  // Handle hash navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (hash) {
      setCurrentSectionId(hash)
      const element = document.getElementById(hash)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [location.hash])

  // Intersection observer to update current section AND mark as read
  useEffect(() => {
    if (!module) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id
            setCurrentSectionId(sectionId)
            
            // Marquer comme lu quand visible à 70%
            if (entry.intersectionRatio >= 0.7) {
              markSectionRead(sectionId)
            }
          }
        })
      },
      { 
        rootMargin: '-20% 0% -60% 0%',
        threshold: [0.3, 0.7]
      }
    )

    module.sections.forEach((section) => {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [module, markSectionRead])

  if (!module) {
    return (
      <div className="container py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Module non trouvé</h1>
        <p className="text-muted-foreground mb-6">
          Le tutoriel demandé n'existe pas.
        </p>
        <Button asChild>
          <Link to="/tutoriels">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux tutoriels
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <TutorielLayout currentModuleId={moduleId} currentSectionId={currentSectionId}>
      <div className="max-w-3xl mx-auto py-8 px-4 md:px-6">
        {/* Mobile search */}
        <div className="lg:hidden mb-6">
          <TutorielSearch />
        </div>

        {/* Back link */}
        <Link 
          to="/tutoriels"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Tous les tutoriels
        </Link>

        {/* Header with progress */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-3xl font-bold">{module.title}</h1>
            {isCompleted && (
              <Badge className="bg-green-500 hover:bg-green-600 shrink-0">
                <CheckCircle className="h-3 w-3 mr-1" />
                Complété
              </Badge>
            )}
          </div>
          <p className="text-lg text-muted-foreground mb-4">{module.description}</p>
          
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium">{percentComplete}%</span>
            </div>
            <Progress value={percentComplete} className="h-2" />
          </div>
          
          <TutorielProgress 
            estimatedTime={module.estimatedTime}
            level={module.level}
            sectionsCount={module.sections.length}
          />
        </div>

        <Separator className="mb-8" />

        {/* Table of contents with completion status */}
        <div className="mb-8 p-4 rounded-lg bg-muted/50">
          <h2 className="font-semibold mb-3">Sommaire</h2>
          <ol className="space-y-2">
            {module.sections.map((section, index) => {
              const isRead = completedSections.includes(section.id)
              return (
                <li key={section.id}>
                  <a 
                    href={`#${section.id}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${
                      isRead 
                        ? 'bg-green-500 text-white' 
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {isRead ? <CheckCircle className="h-3 w-3" /> : index + 1}
                    </span>
                    <span className={isRead ? 'text-foreground' : ''}>{section.title}</span>
                  </a>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {module.sections.map((section, index) => (
            <TutorielSection 
              key={section.id} 
              section={section} 
              index={index}
              moduleId={module.id}
              moduleIcon={module.icon}
            />
          ))}
        </div>

        <Separator className="my-8" />

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {previousModule ? (
            <Button variant="outline" asChild>
              <Link to={`/tutoriels/${previousModule.id}`}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                {previousModule.title}
              </Link>
            </Button>
          ) : (
            <div />
          )}
          
          {nextModule ? (
            <Button variant="outline" asChild>
              <Link to={`/tutoriels/${nextModule.id}`}>
                {nextModule.title}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/tutoriels">
                Retour aux tutoriels
              </Link>
            </Button>
          )}
        </div>
      </div>
    </TutorielLayout>
  )
}
