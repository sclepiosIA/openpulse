import { Link } from 'react-router-dom';
import { FileText, ExternalLink, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PulseMarkdownRenderer } from './PulseMarkdownRenderer';
import type { PulseMessage } from '@/types/pulse';

interface TranscriptionSummaryMetadata {
  type: 'transcription_summary';
  session_id: string;
  document_id?: string;
  document_url?: string;
  decisions_count?: number;
  next_steps_count?: number;
}

interface TranscriptionSummaryCardProps {
  message: PulseMessage;
}

export function TranscriptionSummaryCard({ message }: TranscriptionSummaryCardProps) {
  const metadata = message.metadata as TranscriptionSummaryMetadata | null;
  
  const documentUrl = metadata?.document_url || 
    (metadata?.document_id ? `/documents?source=transcription&id=${metadata.document_id}` : null);
  
  const decisionsCount = metadata?.decisions_count;
  const nextStepsCount = metadata?.next_steps_count;

  return (
    <Card className="border-l-4 border-l-primary/60 bg-gradient-to-r from-muted/50 via-background to-background shadow-sm max-w-2xl">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Compte-rendu de réunion</span>
          </div>
          <div className="flex items-center gap-1.5">
            {decisionsCount != null && decisionsCount > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {decisionsCount} décision{decisionsCount > 1 ? 's' : ''}
              </Badge>
            )}
            {nextStepsCount != null && nextStepsCount > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <ArrowRight className="h-3 w-3" />
                {nextStepsCount} étape{nextStepsCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
          <PulseMarkdownRenderer content={message.content} />
        </div>
        
        {documentUrl && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
              <Link to={documentUrl}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Voir le document complet
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to check if a message is a transcription summary
export function isTranscriptionSummary(message: PulseMessage): boolean {
  const metadata = message.metadata as { type?: string } | null;
  return metadata?.type === 'transcription_summary';
}
