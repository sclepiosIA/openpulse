import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ActionProgressStatus = 'idle' | 'loading' | 'success' | 'error';

interface ActionProgressProps {
  status: ActionProgressStatus;
  progress?: number;
  message?: string;
  successMessage?: string;
  errorMessage?: string;
  className?: string;
  showProgress?: boolean;
}

/**
 * Composant de feedback pour les actions longues
 * Affiche un indicateur de progression avec message
 */
export function ActionProgress({
  status,
  progress = 0,
  message,
  successMessage = "Opération terminée",
  errorMessage = "Une erreur est survenue",
  className,
  showProgress = true,
}: ActionProgressProps) {
  if (status === 'idle') return null;

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg animate-fade-in",
        status === 'loading' && "bg-muted",
        status === 'success' && "bg-green-50 dark:bg-green-950/30",
        status === 'error' && "bg-destructive/10",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {status === 'loading' && (
        <>
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {message || "Chargement en cours..."}
            </p>
            {showProgress && progress > 0 && (
              <Progress value={progress} className="h-1.5 mt-2" />
            )}
          </div>
          {showProgress && progress > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {Math.round(progress)}%
            </span>
          )}
        </>
      )}
      
      {status === 'success' && (
        <>
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            {successMessage}
          </p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <XCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive">
            {errorMessage}
          </p>
        </>
      )}
    </div>
  );
}

// Hook pour gérer l'état de progression
import { useState, useCallback } from "react";

export function useActionProgress() {
  const [status, setStatus] = useState<ActionProgressStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  
  const start = useCallback((initialMessage?: string) => {
    setStatus('loading');
    setProgress(0);
    setMessage(initialMessage || '');
  }, []);
  
  const updateProgress = useCallback((value: number, newMessage?: string) => {
    setProgress(value);
    if (newMessage) setMessage(newMessage);
  }, []);
  
  const complete = useCallback(() => {
    setStatus('success');
    setProgress(100);
    // Auto-reset après 3s
    setTimeout(() => {
      setStatus('idle');
      setProgress(0);
      setMessage('');
    }, 3000);
  }, []);
  
  const fail = useCallback((errorMsg?: string) => {
    setStatus('error');
    if (errorMsg) setMessage(errorMsg);
    // Auto-reset après 5s
    setTimeout(() => {
      setStatus('idle');
      setProgress(0);
      setMessage('');
    }, 5000);
  }, []);
  
  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setMessage('');
  }, []);
  
  return {
    status,
    progress,
    message,
    start,
    updateProgress,
    complete,
    fail,
    reset,
  };
}
