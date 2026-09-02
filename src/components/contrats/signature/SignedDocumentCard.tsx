import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Download, FileText, ShieldCheck } from 'lucide-react';
import { createContratSignedUrl } from '@/services/contrats/signedDocumentUrl';
import { useToast } from '@/hooks/shared/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  path: string;
  documentHash: string | null;
  completedAt: string | null;
}

export default function SignedDocumentCard({ path, documentHash, completedAt }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const url = await createContratSignedUrl(path);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast({ title: 'Erreur', description: 'Impossible de générer le lien signé', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-green-200 bg-green-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          Document signé
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs truncate">{path.split('/').pop()}</span>
        </div>
        {completedAt && (
          <p className="text-xs text-muted-foreground">
            Complété le {format(new Date(completedAt), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
          </p>
        )}
        {documentHash && (
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium">Hash du document (SHA-256)</p>
              <Badge variant="outline" className="font-mono text-[10px] mt-1 break-all">
                {documentHash}
              </Badge>
            </div>
          </div>
        )}
        <Button onClick={handleDownload} disabled={loading} className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          {loading ? 'Génération…' : 'Télécharger le PDF signé'}
        </Button>
      </CardContent>
    </Card>
  );
}
