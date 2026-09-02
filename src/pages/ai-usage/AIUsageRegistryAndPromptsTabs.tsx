import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AI_FUNCTIONS_REGISTRY, CATEGORY_CONFIG, MODEL_CONFIG,
  type AIFunctionConfig, type AICategory,
} from "@/lib/aiRegistry";
import { formatCost, formatTokens } from "@/hooks/ai/useAIUsageStats";
import { InfoBlock } from "./AIUsageDashboardCards";

interface AIStatsLike {
  callsByProcessingType: Map<string, { count: number; cost: number; tokens: number; successRate: number }>;
}

interface RegistryTabProps {
  filteredRegistry: AIFunctionConfig[];
  registryFilter: AICategory | 'all';
  setRegistryFilter: (v: AICategory | 'all') => void;
  registrySearch: string;
  setRegistrySearch: (v: string) => void;
  stats?: AIStatsLike;
  setSelectedFunction: (fn: AIFunctionConfig) => void;
}

export function AIUsageRegistryTab({
  filteredRegistry, registryFilter, setRegistryFilter,
  registrySearch, setRegistrySearch, stats, setSelectedFunction,
}: RegistryTabProps) {
  return (
    <TabsContent value="registry" className="mt-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher une fonction..." value={registrySearch} onChange={e => setRegistrySearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Badge variant={registryFilter === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setRegistryFilter('all')}>Toutes</Badge>
          {(Object.entries(CATEGORY_CONFIG) as [AICategory, typeof CATEGORY_CONFIG[AICategory]][]).map(([key, cfg]) => (
            <Badge key={key} variant={registryFilter === key ? 'default' : 'outline'} className={cn("cursor-pointer", registryFilter === key ? '' : cfg.bgColor + ' ' + cfg.color)} onClick={() => setRegistryFilter(key)}>
              {cfg.label}
            </Badge>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fonction</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Modèle</TableHead>
                  <TableHead className="text-center">Reasoning</TableHead>
                  <TableHead className="text-right">Tokens max</TableHead>
                  <TableHead className="text-right">Appels</TableHead>
                  <TableHead className="text-right">Coût</TableHead>
                  <TableHead className="text-right">Succès</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistry.map(fn => {
                  const ptStats = stats?.callsByProcessingType.get(fn.processingType);
                  return (
                    <TableRow key={fn.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedFunction(fn)}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{fn.label}</p>
                          <p className="text-xs text-muted-foreground">{fn.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", CATEGORY_CONFIG[fn.category].bgColor, CATEGORY_CONFIG[fn.category].color)} variant="outline">
                          {CATEGORY_CONFIG[fn.category].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs font-mono", MODEL_CONFIG[fn.model]?.bgColor, MODEL_CONFIG[fn.model]?.color)} variant="outline">
                          {MODEL_CONFIG[fn.model]?.label || fn.model}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">{fn.parameters.reasoning_effort}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fn.parameters.max_completion_tokens || '—'}</TableCell>
                      <TableCell className="text-right font-mono">{ptStats?.count || 0}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-700 text-xs">{formatCost(ptStats?.cost || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {ptStats ? `${(ptStats.successRate * 100).toFixed(0)}%` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">{filteredRegistry.length} fonctions sur {AI_FUNCTIONS_REGISTRY.length}</p>
    </TabsContent>
  );
}

interface PromptsTabProps {
  filteredPrompts: AIFunctionConfig[];
  promptCategoryFilter: AICategory | 'all';
  setPromptCategoryFilter: (v: AICategory | 'all') => void;
  promptSearch: string;
  setPromptSearch: (v: string) => void;
}

export function AIUsagePromptsTab({
  filteredPrompts, promptCategoryFilter, setPromptCategoryFilter,
  promptSearch, setPromptSearch,
}: PromptsTabProps) {
  return (
    <TabsContent value="prompts" className="mt-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher dans les prompts..." value={promptSearch} onChange={e => setPromptSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Badge variant={promptCategoryFilter === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setPromptCategoryFilter('all')}>Toutes</Badge>
          {(Object.entries(CATEGORY_CONFIG) as [AICategory, typeof CATEGORY_CONFIG[AICategory]][]).map(([key, cfg]) => (
            <Badge key={key} variant={promptCategoryFilter === key ? 'default' : 'outline'} className={cn("cursor-pointer", promptCategoryFilter === key ? '' : cfg.bgColor + ' ' + cfg.color)} onClick={() => setPromptCategoryFilter(key)}>
              {cfg.label}
            </Badge>
          ))}
        </div>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {filteredPrompts.map(fn => (
          <AccordionItem key={fn.id} value={fn.id} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                <Badge className={cn("text-[10px]", CATEGORY_CONFIG[fn.category].bgColor, CATEGORY_CONFIG[fn.category].color)} variant="outline">
                  {CATEGORY_CONFIG[fn.category].label}
                </Badge>
                <div>
                  <p className="font-medium text-sm">{fn.label}</p>
                  <p className="text-xs text-muted-foreground">{fn.id}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 py-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">System Prompt</p>
                  <div className="bg-muted rounded-md p-3 text-sm font-mono whitespace-pre-wrap">{fn.systemPromptPreview}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Modèle</p>
                    <Badge className={cn("text-xs mt-1", MODEL_CONFIG[fn.model]?.bgColor, MODEL_CONFIG[fn.model]?.color)} variant="outline">
                      {MODEL_CONFIG[fn.model]?.label || fn.model}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reasoning</p>
                    <p className="text-sm font-mono mt-1">{fn.parameters.reasoning_effort}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max tokens</p>
                    <p className="text-sm font-mono mt-1">{fn.parameters.max_completion_tokens || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Format</p>
                    <p className="text-sm font-mono mt-1">{fn.parameters.response_format || 'text'}</p>
                  </div>
                </div>
                {fn.securityFeatures.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Sécurité</p>
                    <div className="flex gap-1 flex-wrap">
                      {fn.securityFeatures.map(sf => (
                        <Badge key={sf} variant="secondary" className="text-[10px]"><Shield className="h-3 w-3 mr-1" />{sf}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p className="text-xs text-muted-foreground text-center">{filteredPrompts.length} fonctions affichées</p>
    </TabsContent>
  );
}

interface FunctionDetailDialogProps {
  selectedFunction: AIFunctionConfig | null;
  setSelectedFunction: (fn: AIFunctionConfig | null) => void;
  stats?: AIStatsLike;
}

export function AIUsageFunctionDetailDialog({
  selectedFunction, setSelectedFunction, stats,
}: FunctionDetailDialogProps) {
  return (
    <Dialog open={!!selectedFunction} onOpenChange={(open) => { if (!open) setSelectedFunction(null); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        {selectedFunction && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge className={cn("text-xs", CATEGORY_CONFIG[selectedFunction.category].bgColor, CATEGORY_CONFIG[selectedFunction.category].color)} variant="outline">
                  {CATEGORY_CONFIG[selectedFunction.category].label}
                </Badge>
                {selectedFunction.label}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedFunction.description}</p>

              <div className="grid grid-cols-2 gap-3">
                <InfoBlock label="Edge Function" value={selectedFunction.id} />
                <InfoBlock label="Processing Type" value={selectedFunction.processingType} />
                <InfoBlock label="Modèle" value={MODEL_CONFIG[selectedFunction.model]?.label || selectedFunction.model} />
                <InfoBlock label="Timeout" value={`${selectedFunction.parameters.timeout_ms / 1000}s`} />
                <InfoBlock label="Reasoning" value={selectedFunction.parameters.reasoning_effort} />
                <InfoBlock label="Verbosity" value={selectedFunction.parameters.verbosity} />
                <InfoBlock label="Max tokens" value={selectedFunction.parameters.max_completion_tokens.toString()} />
                <InfoBlock label="Format" value={selectedFunction.parameters.response_format || 'text'} />
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Chaîne de fallback</p>
                <div className="flex gap-1 items-center flex-wrap">
                  {selectedFunction.fallbackChain.map((m, i) => (
                    <span key={m} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground text-xs">→</span>}
                      <Badge variant="outline" className="text-xs font-mono">{m}</Badge>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">System Prompt (extrait)</p>
                <div className="bg-muted rounded-md p-3 text-xs font-mono">{selectedFunction.systemPromptPreview}</div>
              </div>

              {selectedFunction.securityFeatures.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Features de sécurité</p>
                  <div className="flex gap-1 flex-wrap">
                    {selectedFunction.securityFeatures.map(sf => (
                      <Badge key={sf} variant="secondary" className="text-[10px]"><Shield className="h-3 w-3 mr-1" />{sf}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {(() => {
                const ptStats = stats?.callsByProcessingType.get(selectedFunction.processingType);
                if (!ptStats) return null;
                return (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Métriques réelles</p>
                    <div className="grid grid-cols-2 gap-2">
                      <InfoBlock label="Appels" value={ptStats.count.toString()} />
                      <InfoBlock label="Coût total" value={formatCost(ptStats.cost)} />
                      <InfoBlock label="Tokens" value={formatTokens(ptStats.tokens)} />
                      <InfoBlock label="Taux succès" value={`${(ptStats.successRate * 100).toFixed(0)}%`} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
