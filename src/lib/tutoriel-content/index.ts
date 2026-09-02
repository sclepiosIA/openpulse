import { TutorielModule } from '@/types/tutoriel'
import { premierDemarrageModule } from './premier-demarrage'
import { priseEnMainModule } from './prise-en-main'
import { dashboardModule } from './dashboard'
import { crmModule } from './crm'
import { emailsModule } from './emails'
import { deploiementModule } from './deploiement'
import { productionModule } from './production'
import { projetsModule } from './projets'
import { tresorerieModule } from './tresorerie'
import { rhModule } from './rh'
import { calendrierModule } from './calendrier'
import { ganttModule } from './gantt'
import { groupesPartenairesModule } from './groupes-partenaires'
import { analyseGeographiqueModule } from './analyse-geographique'
import { rapportsModule } from './rapports'
import { administrationModule } from './administration'
import { supportModule } from './support'
import { contratsModule } from './contrats'
import { recrutementModule } from './recrutement'
import { facturationModule } from './facturation'
import { documentsModule } from './documents'
import { visioModule } from './visio'
import { rdAgileModule } from './rd-agile'
import { jarvisModule } from './jarvis'

/**

 * Le module « forum » a été retiré de cette liste : il enseignait un écran
 * qu'aucune route ne sert dans la distribution. Il n'existe pas de chemin
 * `/forum`, aucune entrée de menu n'y mène, et le composant qui affiche la
 * liste des sujets n'est monté nulle part depuis le retrait des espaces de
 * formation. Un tutoriel qui décrit un écran inaccessible envoie le lecteur
 * chercher ce qui n'est pas là.
 */
export const tutorielModules: TutorielModule[] = [
  premierDemarrageModule,
  priseEnMainModule,
  dashboardModule,
  calendrierModule,
  emailsModule,
  visioModule,
  jarvisModule,
  crmModule,
  groupesPartenairesModule,
  deploiementModule,
  productionModule,
  projetsModule,
  ganttModule,
  rdAgileModule,
  tresorerieModule,
  facturationModule,
  rhModule,
  recrutementModule,
  supportModule,
  contratsModule,
  rapportsModule,
  analyseGeographiqueModule,
  documentsModule,
  administrationModule,
]

export const getModuleById = (id: string): TutorielModule | undefined => {
  return tutorielModules.find(m => m.id === id)
}

export const getModulesByCategory = (category: string): TutorielModule[] => {
  return tutorielModules.filter(m => m.category === category)
}

export const searchModules = (query: string): TutorielModule[] => {
  const lowercaseQuery = query.toLowerCase()
  return tutorielModules.filter(m =>
    m.title.toLowerCase().includes(lowercaseQuery) ||
    m.description.toLowerCase().includes(lowercaseQuery) ||
    m.sections.some(s =>
      s.title.toLowerCase().includes(lowercaseQuery) ||
      s.steps.some(step =>
        step.title.toLowerCase().includes(lowercaseQuery) ||
        step.content.toLowerCase().includes(lowercaseQuery)
      )
    )
  )
}

export {
  premierDemarrageModule,
  priseEnMainModule,
  dashboardModule,
  crmModule,
  emailsModule,
  deploiementModule,
  productionModule,
  projetsModule,
  tresorerieModule,
  rhModule,
  calendrierModule,
  ganttModule,
  groupesPartenairesModule,
  analyseGeographiqueModule,
  rapportsModule,
  administrationModule,
  supportModule,
  contratsModule,
  recrutementModule,
  facturationModule,
  documentsModule,
  visioModule,
  rdAgileModule,
  jarvisModule,
}
