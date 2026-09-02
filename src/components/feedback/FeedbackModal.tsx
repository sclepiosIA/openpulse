import { useState, useEffect } from 'react';
import { debug } from '@/lib/debug';
import { useLocation } from 'react-router-dom';
import { fromExtended } from '@/lib/supabaseTyped';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/shared/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { consoleCapture } from '@/lib/consoleCapture';
import {
  Bug,
  Lightbulb,
  HelpCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Image,
  Terminal,
  Send,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadPublicFile } from '@/services/storage/publicUploads';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenshot: Blob | null;
}

type FeedbackType = 'bug' | 'amelioration' | 'question' | 'autre';
type Priority = 'low' | 'medium' | 'high' | 'critical';

const feedbackTypes: { value: FeedbackType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-destructive' },
  { value: 'amelioration', label: 'Amélioration', icon: Lightbulb, color: 'text-amber-500' },
  { value: 'question', label: 'Question', icon: HelpCircle, color: 'text-blue-500' },
  { value: 'autre', label: 'Autre', icon: MessageSquare, color: 'text-muted-foreground' },
];

const priorities: { value: Priority; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'low', label: 'Basse', icon: Minus, color: 'text-muted-foreground' },
  { value: 'medium', label: 'Moyenne', icon: Info, color: 'text-blue-500' },
  { value: 'high', label: 'Haute', icon: AlertCircle, color: 'text-amber-500' },
  { value: 'critical', label: 'Critique', icon: AlertTriangle, color: 'text-destructive' },
];

export function FeedbackModal({ open, onOpenChange, screenshot }: FeedbackModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  
  const [type, setType] = useState<FeedbackType>('bug');
  const [priority, setPriority] = useState<Priority>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // Créer une preview de la capture d'écran
  useEffect(() => {
    if (screenshot) {
      const url = URL.createObjectURL(screenshot);
      setScreenshotPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setScreenshotPreview(null);
    }
  }, [screenshot]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setType('bug');
      setPriority('medium');
      setTitle('');
      setDescription('');
      setIsLogsOpen(false);
    }
  }, [open]);

  const logs = consoleCapture.getLogs();
  const errorLogs = consoleCapture.getErrorLogs();

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: 'Titre requis',
        description: 'Veuillez donner un titre à votre retour.',
        variant: 'destructive'
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Non connecté',
        description: 'Vous devez être connecté pour envoyer un feedback.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let screenshotUrl: string | null = null;

      // Upload screenshot si disponible
      if (screenshot) {
        const fileName = `${user.id}/${Date.now()}-feedback.png`;
        try {
          const { publicUrl } = await uploadPublicFile('feedback-screenshots', fileName, screenshot, {
            contentType: 'image/png',
            upsert: false,
          });
          screenshotUrl = publicUrl;
        } catch (uploadError) {
          debug.error('[FeedbackModal] Erreur upload screenshot:', uploadError);
        }
      }

      // Préparer les infos navigateur
      const browserInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        timestamp: new Date().toISOString()
      };

      // Insérer le feedback via helper typé
      const { error: insertError } = await fromExtended('user_feedbacks')
        .insert({
          user_id: user.id,
          type,
          priority,
          title: title.trim(),
          description: description.trim() || null,
          screenshot_url: screenshotUrl,
          current_route: location.pathname + location.search,
          console_logs: logs.length > 0 ? logs : null,
          browser_info: browserInfo
        });

      if (insertError) {
        throw insertError;
      }

      toast({
        title: 'Merci pour votre retour ! 🙏',
        description: 'Votre feedback a été envoyé avec succès.',
      });

      onOpenChange(false);
    } catch (error) {
      debug.error('[FeedbackModal] Erreur soumission:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer le feedback. Veuillez réessayer.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        id="feedback-modal" 
        className="w-[95vw] sm:w-auto sm:max-w-[600px] max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Donner un retour
          </DialogTitle>
          <DialogDescription>
            Signalez un bug, suggérez une amélioration ou posez une question.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
          <div className="space-y-6 py-4">
            {/* Type de feedback */}
            <div className="space-y-2">
              <Label>Type de retour</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {feedbackTypes.map((ft) => {
                  const Icon = ft.icon;
                  return (
                    <Button
                      key={ft.value}
                      type="button"
                      variant={type === ft.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setType(ft.value)}
                      className={cn(
                        "flex flex-col h-auto py-3 gap-1 min-h-[60px] sm:min-h-[48px]",
                        type === ft.value && "ring-2 ring-primary"
                      )}
                    >
                      <Icon className={cn("h-5 w-5", type !== ft.value && ft.color)} />
                      <span className="text-xs">{ft.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Priorité */}
            <div className="space-y-2">
              <Label>Priorité</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {priorities.map((p) => {
                  const Icon = p.icon;
                  return (
                    <Button
                      key={p.value}
                      type="button"
                      variant={priority === p.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPriority(p.value)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px]",
                        priority === p.value && "ring-2 ring-primary"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", priority !== p.value && p.color)} />
                      <span className="text-xs">{p.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Titre */}
            <div className="space-y-2">
              <Label htmlFor="feedback-title">
                Titre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="feedback-title"
                placeholder="Décrivez brièvement votre retour..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="feedback-description">Description (optionnel)</Label>
              <Textarea
                id="feedback-description"
                placeholder="Donnez plus de détails : étapes pour reproduire le bug, contexte, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Aperçu capture d'écran */}
            {screenshotPreview && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Capture d'écran
                </Label>
                <div className="relative rounded-lg border overflow-hidden bg-muted">
                  <img loading="lazy" decoding="async" src={screenshotPreview} 
                    alt="Capture d'écran" 
                    className="w-full h-32 object-cover object-top" />
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="text-xs">
                      Sera jointe automatiquement
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Logs console (collapsible) */}
            <Collapsible open={isLogsOpen} onOpenChange={setIsLogsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between px-3"
                >
                  <span className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Logs console ({logs.length})
                    {errorLogs.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {errorLogs.length} erreur{errorLogs.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </span>
                  {isLogsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-lg bg-muted p-3 max-h-48 overflow-auto font-mono text-xs">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground">Aucun log capturé</p>
                  ) : (
                    logs.map((log, i) => {
                      const time = new Date(log.timestamp).toLocaleTimeString('fr-FR');
                      const levelColors = {
                        log: 'text-foreground',
                        info: 'text-blue-500',
                        warn: 'text-amber-500',
                        error: 'text-destructive'
                      };
                      return (
                        <div key={i} className={cn("mb-1", levelColors[log.level])}>
                          <span className="text-muted-foreground">[{time}]</span>{' '}
                          <span className="font-semibold">{log.level.toUpperCase()}:</span>{' '}
                          {log.args.join(' ')}
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ces logs seront inclus pour aider au diagnostic.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Envoyer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
