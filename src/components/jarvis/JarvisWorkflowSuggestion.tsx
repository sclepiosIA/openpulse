 /**
  * JARVIS V12.0 - Workflow Suggestion Component
  * 
  * Affiche les suggestions de workflows automatisés détectés
  */
 
 import React, { useState } from 'react';
 import { debug } from '@/lib/debug';
 import { motion, AnimatePresence } from 'framer-motion';
 import {
  Workflow,
  ArrowRight,
  Zap,
  Clock,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { cn } from '@/lib/utils';
 import { useToast } from '@/hooks/shared/use-toast';
 import { invokeEdge } from "@/services/edgeFunctions";
 interface WorkflowSuggestion {
   id: string;
   name: string;
   description: string;
   actions: string[];
   confidence: number;
   timesSaved: number;
   suggestedAt: string;
 }
 
 interface JarvisWorkflowSuggestionProps {
   suggestions: WorkflowSuggestion[];
   onAccept: (suggestion: WorkflowSuggestion) => Promise<void>;
   onDismiss: (suggestionId: string) => void;
   className?: string;
 }
 
 const actionLabels: Record<string, { label: string; icon: string; color: string }> = {
   send_email: { label: 'Email', icon: '📧', color: 'bg-blue-500/10 text-blue-500' },
   create_task: { label: 'Tâche', icon: '✅', color: 'bg-green-500/10 text-green-500' },
   schedule_meeting: { label: 'Réunion', icon: '📅', color: 'bg-purple-500/10 text-purple-500' },
   manage_invoice: { label: 'Facture', icon: '💰', color: 'bg-amber-500/10 text-amber-500' },
   manage_contact: { label: 'Contact', icon: '👤', color: 'bg-cyan-500/10 text-cyan-500' },
   update_etablissement: { label: 'Établissement', icon: '🏥', color: 'bg-rose-500/10 text-rose-500' }
 };
 
 export function JarvisWorkflowSuggestion({
   suggestions,
   onAccept,
   onDismiss,
   className
 }: JarvisWorkflowSuggestionProps) {
   const [expandedId, setExpandedId] = useState<string | null>(null);
   const [creatingId, setCreatingId] = useState<string | null>(null);
   const { toast } = useToast();
 
   const handleAccept = async (suggestion: WorkflowSuggestion) => {
     setCreatingId(suggestion.id);
     try {
       await onAccept(suggestion);
       toast({
         title: "✨ Workflow créé",
         description: `"${suggestion.name}" est maintenant automatisé`
       });
     } catch (error) {
       toast({
         title: "Erreur",
         description: "Impossible de créer le workflow",
         variant: "destructive"
       });
     } finally {
       setCreatingId(null);
     }
   };
 
   if (suggestions.length === 0) {
     return null;
   }
 
   return (
     <Card className={cn("border-dashed border-primary/30 bg-primary/5", className)}>
       <CardHeader className="pb-3">
         <CardTitle className="flex items-center gap-2 text-base">
           <Workflow className="h-5 w-5 text-primary" />
           Workflows suggérés
           <Badge variant="secondary" className="ml-auto">
             {suggestions.length} détecté{suggestions.length > 1 ? 's' : ''}
           </Badge>
         </CardTitle>
       </CardHeader>
       <CardContent className="space-y-3">
         <AnimatePresence mode="popLayout">
           {suggestions.map((suggestion) => (
             <motion.div
               key={suggestion.id}
               layout
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, x: -100 }}
               className="border border-border rounded-lg p-3 bg-background/50"
             >
               {/* Header */}
               <div className="flex items-start justify-between gap-2">
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                     <Sparkles className="h-4 w-4 text-primary" />
                     <span className="font-medium text-sm">{suggestion.name}</span>
                   </div>
                   <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                 </div>
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-6 w-6 shrink-0"
                   onClick={() => onDismiss(suggestion.id)} aria-label="Fermer">
                   <X className="h-3.5 w-3.5" />
                 </Button>
               </div>
 
               {/* Actions flow preview */}
               <div className="flex items-center gap-1 mt-3 flex-wrap">
                 {suggestion.actions.map((action, index) => {
                   const actionInfo = actionLabels[action] || { label: action, icon: '⚡', color: 'bg-muted' };
                   return (
                     <React.Fragment key={`workflow-action-${action}-${index}`}>
                       <Badge 
                         variant="secondary" 
                         className={cn("text-xs", actionInfo.color)}
                       >
                         <span className="mr-1">{actionInfo.icon}</span>
                         {actionInfo.label}
                       </Badge>
                       {index < suggestion.actions.length - 1 && (
                         <ArrowRight className="h-3 w-3 text-muted-foreground" />
                       )}
                     </React.Fragment>
                   );
                 })}
               </div>
 
               {/* Stats */}
               <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                 <div className="flex items-center gap-1">
                   <Zap className="h-3 w-3" />
                   <span>Confiance: {Math.round(suggestion.confidence * 100)}%</span>
                 </div>
                 <div className="flex items-center gap-1">
                   <Clock className="h-3 w-3" />
                   <span>~{suggestion.timesSaved} min économisés</span>
                 </div>
               </div>
 
               {/* Expand/collapse details */}
               <Button
                 variant="ghost"
                 size="sm"
                 className="w-full mt-2 h-7 text-xs"
                 onClick={() => setExpandedId(expandedId === suggestion.id ? null : suggestion.id)}
               >
                 {expandedId === suggestion.id ? (
                   <>
                     <ChevronUp className="h-3 w-3 mr-1" />
                     Moins de détails
                   </>
                 ) : (
                   <>
                     <ChevronDown className="h-3 w-3 mr-1" />
                     Plus de détails
                   </>
                 )}
               </Button>
 
               {/* Expanded details */}
               <AnimatePresence>
                 {expandedId === suggestion.id && (
                   <motion.div
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     className="overflow-hidden"
                   >
                     <div className="pt-3 border-t border-border/50 mt-2">
                       <p className="text-xs text-muted-foreground mb-2">
                         Ce workflow sera déclenché manuellement. Vous pourrez le lancer depuis le panel Jarvis.
                       </p>
                       <div className="flex gap-2">
                         <Button
                           size="sm"
                           className="flex-1"
                           onClick={() => handleAccept(suggestion)}
                           disabled={creatingId === suggestion.id}
                         >
                           {creatingId === suggestion.id ? (
                             <>
                               <motion.div
                                 animate={{ rotate: 360 }}
                                 transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                               >
                                 <Sparkles className="h-3.5 w-3.5 mr-1" />
                               </motion.div>
                               Création...
                             </>
                           ) : (
                             <>
                               <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                               Créer ce workflow
                             </>
                           )}
                         </Button>
                       </div>
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </motion.div>
           ))}
         </AnimatePresence>
       </CardContent>
     </Card>
   );
 }
 
 /**
  * Hook pour récupérer les suggestions de workflow
  */
 export function useWorkflowSuggestions() {
   const [suggestions, setSuggestions] = useState<WorkflowSuggestion[]>([]);
   const [isLoading, setIsLoading] = useState(false);
 
   const fetchSuggestions = async () => {
     setIsLoading(true);
     try {
       const data = await invokeEdge<any>('jarvis-workflow-learner', { action: 'get_suggestions' });
       setSuggestions(data.suggestions || []);
     } catch (error) {
       debug.error('Failed to fetch workflow suggestions:', error);
     } finally {
       setIsLoading(false);
     }
   };
 
   const acceptSuggestion = async (suggestion: WorkflowSuggestion) => {
     await invokeEdge('jarvis-workflow-learner', {
         action: 'create_workflow',
         workflowName: suggestion.name,
         actions: suggestion.actions,
         description: suggestion.description
       });
     // Remove from suggestions
     setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
   };
 
   const dismissSuggestion = (suggestionId: string) => {
     setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
   };
 
   return {
     suggestions,
     isLoading,
     fetchSuggestions,
     acceptSuggestion,
     dismissSuggestion
   };
 }