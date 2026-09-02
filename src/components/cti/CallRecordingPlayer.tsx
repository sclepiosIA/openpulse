/**
 * CallRecordingPlayer — lecteur audio inline avec signed URL temporaire.
 */
import { useEffect, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRecordingSignedUrl } from '@/hooks/voice/useCalls';

interface Props {
  recordingPath: string | null;
}

export function CallRecordingPlayer({ recordingPath }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUrl(null);
  }, [recordingPath]);

  if (!recordingPath) {
    return <span className="text-xs text-muted-foreground">Pas d'enregistrement</span>;
  }

  if (!url) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          const signed = await getRecordingSignedUrl(recordingPath, 300);
          setUrl(signed);
          setLoading(false);
        }}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Play className="h-3 w-3 mr-2" />}
        Écouter
      </Button>
    );
  }

  return <audio controls preload="none" src={url} className="h-8 max-w-[260px]" />;
}
