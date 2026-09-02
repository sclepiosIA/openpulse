import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TUTORIEL_CATEGORIES } from '@/types/tutoriel'
import { getModuleById } from '@/lib/tutoriel-content'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface TutorielSidebarProps {
  currentModuleId?: string
  currentSectionId?: string
}

export function TutorielSidebar({ currentModuleId, currentSectionId }: TutorielSidebarProps) {
  return (
    <nav className="p-2">
      {TUTORIEL_CATEGORIES.map((category) => {
        const categoryModules = category.modules
          .map(id => getModuleById(id))
          .filter(Boolean)
        
        if (categoryModules.length === 0) return null
        
        return (
          <div key={category.id} className="mb-4">
            <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {category.label}
            </h3>
            <ul className="space-y-1">
              {categoryModules.map((module) => {
                if (!module) return null
                const isActive = currentModuleId === module.id
                
                return (
                  <li key={module.id}>
                    <Collapsible defaultOpen={isActive}>
                      <CollapsibleTrigger asChild>
                        <Link
                          to={`/tutoriels/${module.id}`}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full',
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'hover:bg-accent text-foreground'
                          )}
                        >
                          <ChevronRight 
                            className={cn(
                              'h-4 w-4 transition-transform flex-shrink-0',
                              isActive && 'rotate-90'
                            )} 
                          />
                          <span className="truncate">{module.title}</span>
                        </Link>
                      </CollapsibleTrigger>
                      
                      {isActive && (
                        <CollapsibleContent>
                          <ul className="ml-6 mt-1 space-y-1 border-l pl-3">
                            {module.sections.map((section) => (
                              <li key={section.id}>
                                <Link
                                  to={`/tutoriels/${module.id}#${section.id}`}
                                  className={cn(
                                    'block px-2 py-1.5 text-sm rounded-md transition-colors',
                                    currentSectionId === section.id
                                      ? 'bg-primary/5 text-primary'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                  )}
                                >
                                  {section.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
