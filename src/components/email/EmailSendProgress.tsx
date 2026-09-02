import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2 } from "lucide-react";

interface EmailSendProgressProps {
  isSending: boolean;
  onComplete?: () => void;
}

export function EmailSendProgress({ isSending, onComplete }: EmailSendProgressProps) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'preparing' | 'sending' | 'finalizing' | 'done'>('preparing');

  useEffect(() => {
    if (!isSending) {
      setProgress(0);
      setStage('preparing');
      return;
    }

    // Simulate progress stages
    const timer1 = setTimeout(() => {
      setProgress(30);
      setStage('preparing');
    }, 200);

    const timer2 = setTimeout(() => {
      setProgress(60);
      setStage('sending');
    }, 800);

    const timer3 = setTimeout(() => {
      setProgress(90);
      setStage('finalizing');
    }, 1500);

    const timer4 = setTimeout(() => {
      setProgress(100);
      setStage('done');
      onComplete?.();
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [isSending, onComplete]);

  if (!isSending && stage !== 'done') return null;

  const stageLabels = {
    preparing: 'Préparation du message...',
    sending: 'Envoi en cours...',
    finalizing: 'Finalisation...',
    done: 'Email envoyé avec succès !'
  };

  const StageIcon = stage === 'done' ? CheckCircle2 : Loader2;

  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <StageIcon 
            className={`h-5 w-5 ${stage === 'done' ? 'text-green-600' : 'text-primary animate-spin'}`} 
          />
          <span className="text-sm font-medium">{stageLabels[stage]}</span>
        </div>
        
        <Progress value={progress} className="h-2" />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progression</span>
          <span>{progress}%</span>
        </div>
      </div>
    </Card>
  );
}
