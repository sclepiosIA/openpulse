import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SimulatorMainParams } from './SimulatorMainParams';
import { SimulatorAdvancedParams } from './SimulatorAdvancedParams';
import { SimulationResultsPanel } from './SimulationResultsPanel';
import { QuoteConfigPanel } from './QuoteConfigPanel';
import { QuoteProjectionsTable } from './QuoteProjectionsTable';
import { QuoteValidationPanel } from './QuoteValidationPanel';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { useSimulatorState } from '@/hooks/quote/useSimulatorState';
import { Calculator, FileText, BarChart3, TrendingUp, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SimulatorContainerProps {
  mode?: 'standalone' | 'etablissement';
  etablissementId?: string;
  etablissementNom?: string;
  initialPassages?: number;
  initialBaseline?: number;
  initialDPIType?: string;
  initialCenterType?: string;
}

export function SimulatorContainer({
  mode = 'standalone',
  etablissementId,
  etablissementNom,
  initialPassages,
  initialBaseline,
  initialDPIType,
  initialCenterType,
}: SimulatorContainerProps) {
  const {
    activeTab,
    setActiveTab,
    params,
    configuration,
    analyticsParams,
    simulationResults,
    quoteResults,
    analyticsResults,
    updateParam,
    updateConfiguration,
    updateAnalyticsParam,
  } = useSimulatorState({
    initialPassages,
    initialBaseline,
    initialDPIType,
    initialCenterType,
  });

  const hasGains = simulationResults && simulationResults.totalGainDiff > 0;

  return (
    <div className="space-y-6">
      {/* En-tête visuel */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Simulateur de Valorisation
                <Sparkles className="h-4 w-4 text-primary" />
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Calculez le potentiel de gains liés à l'optimisation de votre taux UHCD
              </p>
            </div>
          </div>
          {hasGains && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-sm text-muted-foreground">Gain potentiel</div>
              <Badge className="bg-green-500 hover:bg-green-600 text-white text-lg px-3 py-1">
                +{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(simulationResults.totalGainDiff)}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50">
          <TabsTrigger 
            value="simulation" 
            className="flex items-center gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">Simulation</span>
            <span className="sm:hidden text-xs">Simu</span>
          </TabsTrigger>
          <TabsTrigger 
            value="devis" 
            className="flex items-center gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">Devis</span>
            {quoteResults && quoteResults.paliers[3]?.roiNet > 0 && (
              <Badge variant="secondary" className="hidden md:flex text-xs px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                ROI+
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="analytics" 
            className="flex items-center gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">Analytics</span>
            <span className="sm:hidden text-xs">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simulation" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <SimulatorMainParams params={params} onUpdateParam={updateParam} />
              <SimulatorAdvancedParams params={params} onUpdateParam={updateParam} />
            </div>
            <div className="lg:col-span-2">
              <SimulationResultsPanel results={simulationResults} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="devis" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <SimulatorMainParams params={params} onUpdateParam={updateParam} />
              <QuoteConfigPanel configuration={configuration} onUpdateConfiguration={updateConfiguration} />
              {mode === 'etablissement' && quoteResults && (
                <QuoteValidationPanel 
                  results={quoteResults}
                  etablissementId={etablissementId}
                  etablissementNom={etablissementNom}
                />
              )}
            </div>
            <div className="lg:col-span-3">
              {quoteResults && (
                <QuoteProjectionsTable 
                  results={quoteResults} 
                  params={params}
                  etablissementNom={etablissementNom}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <AnalyticsDashboard
            params={params}
            analyticsParams={analyticsParams}
            results={analyticsResults}
            onUpdateAnalyticsParam={updateAnalyticsParam}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
