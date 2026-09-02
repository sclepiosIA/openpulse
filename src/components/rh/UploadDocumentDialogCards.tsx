import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatMontant, type ParsedBulletinData, type UploadResult } from '@/components/rh/uploadDocumentHelpers';

export function MultiUploadProgressCard({
  currentUploadIndex,
  total,
  currentFileName,
}: {
  currentUploadIndex: number;
  total: number;
  currentFileName?: string;
}) {
  return (
    <Card className="border-primary">
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Upload en cours : {currentUploadIndex + 1} / {total}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(((currentUploadIndex + 1) / total) * 100)}%
            </span>
          </div>
          <Progress value={((currentUploadIndex + 1) / total) * 100} />
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">{currentFileName}</p>
          </div>
          <p className="text-xs text-muted-foreground">Analyse automatique avec GPT-5...</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SingleAnalyzingCard() {
  return (
    <Card className="border-primary">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="font-medium">Analyse du bulletin en cours...</p>
            <p className="text-sm text-muted-foreground">GPT-5 extrait les données automatiquement</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ParsedBulletinPreviewCard({ parsedData }: { parsedData: ParsedBulletinData }) {
  return (
    <Card className="border-green-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Bulletin analysé avec succès !
          </CardTitle>
          <Badge variant={parsedData.confidence >= 80 ? 'default' : 'secondary'}>
            Confiance : {parsedData.confidence}%
          </Badge>
        </div>
        <CardDescription>Les données suivantes ont été extraites automatiquement</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">📅 Mois :</span>
            <span className="ml-2 font-medium">
              {parsedData.mois
                ? new Date(parsedData.mois).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">💰 Salaire brut :</span>
            <span className="ml-2 font-medium">{formatMontant(parsedData.salaire_brut)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">💵 Salaire net :</span>
            <span className="ml-2 font-medium">{formatMontant(parsedData.salaire_net)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">📊 Cotisations sal. :</span>
            <span className="ml-2 font-medium">{formatMontant(parsedData.cotisations_salariales)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">🏢 Cotisations patr. :</span>
            <span className="ml-2 font-medium">{formatMontant(parsedData.cotisations_patronales)}</span>
          </div>
          {parsedData.primes && parsedData.primes > 0 && (
            <div>
              <span className="text-muted-foreground">🎁 Primes :</span>
              <span className="ml-2 font-medium">{formatMontant(parsedData.primes)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ParseErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-orange-500">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          <div>
            <p className="font-medium">Analyse échouée</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Le document a été enregistré mais vous devrez saisir le salaire manuellement.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UploadResultsSummaryCard({ results }: { results: UploadResult[] }) {
  const allOk = results.every((r) => r.success);
  return (
    <Card className={allOk ? 'border-green-500' : 'border-orange-500'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {allOk ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Tous les bulletins ont été traités avec succès !
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Certains bulletins ont échoué
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          {results.map((result, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-500" />
              )}
              <span className="flex-1">{result.file}</span>
              {!result.success && (
                <span className="text-xs text-muted-foreground">{result.error}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
