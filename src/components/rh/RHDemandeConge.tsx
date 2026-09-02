import { useState } from "react";
import { debug } from "@/lib/debug";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, Send, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { format, differenceInBusinessDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { invokeEdge } from "@/services/edgeFunctions";
import { supabase } from "@/integrations/supabase/client";

const TYPE_ABSENCE_OPTIONS = [
  { value: 'conge_paye', label: 'Congé payé' },
  { value: 'rtt', label: 'RTT' },
  { value: 'sans_solde', label: 'Sans solde' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'maternite', label: 'Maternité/Paternité' },
  { value: 'formation', label: 'Formation' },
  { value: 'autre', label: 'Autre' },
];

interface ConflictCheck {
  hasConflict: boolean;
  riskScore: number;
  warnings: string[];
  recommendation: string;
}

export function RHDemandeConge() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [type, setType] = useState<string>('');
  const [dateDebut, setDateDebut] = useState<Date | undefined>();
  const [dateFin, setDateFin] = useState<Date | undefined>();
  const [motif, setMotif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [conflictCheck, setConflictCheck] = useState<ConflictCheck | null>(null);

  // Calculer le nombre de jours ouvrés
  const joursOuvres = dateDebut && dateFin 
    ? Math.max(1, differenceInBusinessDays(dateFin, dateDebut) + 1)
    : 0;

  const checkConflicts = async () => {
    if (!dateDebut || !dateFin || !user) return;

    setIsCheckingConflicts(true);
    try {
      const data = await invokeEdge<any>('check-absence-conflicts', {
          profile_id: user.id,
          date_debut: format(dateDebut, 'yyyy-MM-dd'),
          date_fin: format(dateFin, 'yyyy-MM-dd'),
          type_absence: type
        });
    const error = null;

      if (error) throw error;

      setConflictCheck(data);
    } catch (error) {
      debug.error('Error checking conflicts:', error);
      // En cas d'erreur, on permet quand même la soumission
      setConflictCheck(null);
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  // Vérifier les conflits quand les dates changent
  const handleDateChange = (type: 'debut' | 'fin', date: Date | undefined) => {
    if (type === 'debut') {
      setDateDebut(date);
      if (date && !dateFin) {
        setDateFin(date);
      }
    } else {
      setDateFin(date);
    }
    setConflictCheck(null); // Reset le check
  };

  const handleSubmit = async () => {
    if (!type || !dateDebut || !dateFin || !user) {
      toast({
        title: "Formulaire incomplet",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    // Vérifier les conflits avant soumission si pas déjà fait
    if (!conflictCheck) {
      await checkConflicts();
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('rh_absences')
        .insert({
          profile_id: user.id,
          type_absence: type,
          date_debut: format(dateDebut, 'yyyy-MM-dd'),
          date_fin: format(dateFin, 'yyyy-MM-dd'),
          nombre_jours: joursOuvres,
          statut: 'en_attente',
          motif: motif || null
        } as never);

      if (error) throw error;

      toast({
        title: "Demande soumise",
        description: "Votre demande de congé a été envoyée pour validation",
      });

      // Reset form
      setType('');
      setDateDebut(undefined);
      setDateFin(undefined);
      setMotif('');
      setConflictCheck(null);

      // Refresh absences list
      queryClient.invalidateQueries({ queryKey: ['rh-absences'] });

    } catch (error: unknown) {
      debug.error('Error submitting absence:', error);
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Nouvelle demande de congé
        </CardTitle>
        <CardDescription>
          Soumettez votre demande de congé pour validation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type d'absence */}
        <div className="space-y-2">
          <Label>Type d'absence *</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez le type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_ABSENCE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date de début *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateDebut && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateDebut ? format(dateDebut, "dd/MM/yyyy") : "Sélectionner"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateDebut}
                  onSelect={(date) => handleDateChange('debut', date)}
                  disabled={(date) => date < new Date()}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Date de fin *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateFin && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFin ? format(dateFin, "dd/MM/yyyy") : "Sélectionner"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateFin}
                  onSelect={(date) => handleDateChange('fin', date)}
                  disabled={(date) => date < (dateDebut || new Date())}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Résumé jours */}
        {joursOuvres > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm">Jours ouvrés demandés</span>
            <Badge variant="secondary" className="text-lg">
              {joursOuvres} jour{joursOuvres > 1 ? 's' : ''}
            </Badge>
          </div>
        )}

        {/* Motif */}
        <div className="space-y-2">
          <Label>Motif (optionnel)</Label>
          <Textarea
            placeholder="Précisez le motif de votre demande..."
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
          />
        </div>

        {/* Vérification IA des conflits */}
        {dateDebut && dateFin && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={checkConflicts}
              disabled={isCheckingConflicts}
              className="w-full"
            >
              {isCheckingConflicts ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyse IA en cours...
                </>
              ) : (
                <>Vérifier les conflits avec l'IA</>
              )}
            </Button>

            {conflictCheck && (
              <div className={cn(
                "p-4 rounded-lg border",
                conflictCheck.riskScore > 50 
                  ? "bg-destructive/10 border-destructive/30" 
                  : conflictCheck.riskScore > 20 
                    ? "bg-orange-500/10 border-orange-500/30"
                    : "bg-green-500/10 border-green-500/30"
              )}>
                <div className="flex items-start gap-3">
                  {conflictCheck.riskScore > 50 ? (
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  ) : conflictCheck.riskScore > 20 ? (
                    <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-2">
                    <p className="font-medium text-sm">{conflictCheck.recommendation}</p>
                    {conflictCheck.warnings.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {conflictCheck.warnings.map((w, i) => (
                          <li key={i}>• {w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bouton soumission */}
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting || !type || !dateDebut || !dateFin}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Soumettre la demande
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
