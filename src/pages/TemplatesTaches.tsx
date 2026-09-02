import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, ListTodo, Brain, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { PHASE_GROUPS, PhaseKey } from "@/config/phases"
import { useAllModelesTaches } from "@/hooks/tasks/useModelesTaches"
import { useCategories } from "@/hooks/catalogue/useCategories"
import { TemplateTaskList } from "@/components/templates-taches/TemplateTaskList"
import { CreateTemplateDialog } from "@/components/templates-taches/CreateTemplateDialog"
import { PhaseCategories } from "@/components/templates-taches/PhaseCategories"
import { JarvisMemoryManager } from "@/components/jarvis/JarvisMemoryManager"
import { useJarvisMemory } from "@/hooks/jarvis/useJarvisMemory"

type MainTab = "templates" | "jarvis-memory"

export default function TemplatesTaches() {
  const navigate = useNavigate()
  const [mainTab, setMainTab] = useState<MainTab>("templates")
  const [activePhase, setActivePhase] = useState<PhaseKey>("commercial")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  
  const { data: allModeles, isLoading: modelesLoading } = useAllModelesTaches()
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const { memories } = useJarvisMemory()

  // Filtrer les templates par phase en utilisant les catégories définies dans config/phases.ts
  const modelesByPhase = useMemo(() => {
    if (!allModeles || !categories) return { commercial: [], deploiement: [], production: [] }

    const result: Record<PhaseKey, typeof allModeles> = {
      commercial: [],
      deploiement: [],
      production: []
    }

    for (const modele of allModeles) {
      const categoryName = modele.categorie?.nom?.toLowerCase() || ""
      
      for (const [phaseKey, phaseConfig] of Object.entries(PHASE_GROUPS)) {
        const phaseCategories = phaseConfig.categories.map(c => c.toLowerCase())
        if (phaseCategories.some(cat => cat === categoryName)) {
          result[phaseKey as PhaseKey].push(modele)
          break
        }
      }
    }

    return result
  }, [allModeles, categories])

  // Catégories disponibles pour la phase active
  const phaseCategories = useMemo(() => {
    if (!categories) return []
    const phaseCategoryNames = PHASE_GROUPS[activePhase].categories.map(c => c.toLowerCase())
    return categories.filter(cat => 
      phaseCategoryNames.some(pc => pc === cat.nom.toLowerCase())
    )
  }, [categories, activePhase])

  const isLoading = modelesLoading || categoriesLoading
  const totalTemplates = allModeles?.length || 0
  const totalMemories = memories?.length || 0

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/parametres")}
            className="mt-1" aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Settings2 className="h-7 w-7" />
              Templates & IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Configurez les templates de tâches et la mémoire de Jarvis.
            </p>
          </div>
        </div>
        {mainTab === "templates" && (
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouveau template</span>
          </Button>
        )}
      </div>

      {/* Tabs principaux: Templates vs Mémoire Jarvis */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="templates" className="gap-2">
            <ListTodo className="h-4 w-4" />
            Templates
            <Badge variant="secondary" className="ml-1 text-xs">
              {totalTemplates}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="jarvis-memory" className="gap-2">
            <Brain className="h-4 w-4" />
            Mémoire Jarvis
            <Badge variant="secondary" className="ml-1 text-xs">
              {totalMemories}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Contenu Templates */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          {/* Tabs par phase */}
          <Tabs value={activePhase} onValueChange={(v) => setActivePhase(v as PhaseKey)}>
            <TabsList className="grid w-full grid-cols-3">
              {(Object.keys(PHASE_GROUPS) as PhaseKey[]).map((phase) => {
                const config = PHASE_GROUPS[phase]
                const Icon = config.icon
                const count = modelesByPhase[phase]?.length || 0
                
                return (
                  <TabsTrigger key={phase} value={phase} className="gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{config.label}</span>
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {(Object.keys(PHASE_GROUPS) as PhaseKey[]).map((phase) => (
              <TabsContent key={phase} value={phase} className="space-y-4 mt-4">
                {/* Catégories disponibles pour cette phase */}
                <PhaseCategories 
                  phase={phase} 
                  categories={phaseCategories}
                  isLoading={categoriesLoading}
                />
                
                {/* Liste des templates */}
                <TemplateTaskList
                  modeles={modelesByPhase[phase]}
                  categories={phaseCategories}
                  isLoading={isLoading}
                  phase={phase}
                />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* Contenu Mémoire Jarvis */}
        <TabsContent value="jarvis-memory" className="mt-4">
          <JarvisMemoryManager />
        </TabsContent>
      </Tabs>

      {/* Dialog de création de template */}
      <CreateTemplateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        phase={activePhase}
        categories={phaseCategories}
      />
    </div>
  )
}
