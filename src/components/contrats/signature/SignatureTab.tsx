import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, RefreshCw, XCircle, FileSignature, ExternalLink, Clock } from 'lucide-react';
import { useSignatureRequest, useRemindSignature, useCancelSignature } from '@/hooks/contracts/useSignatureRequest';
import { useSignatureEvents } from '@/hooks/contracts/useSignatureEvents';
import { SIGNATURE_STATUS_COLORS, SIGNATURE_STATUS_LABELS, type SignatureSigner } from '@/types/signature';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import SignatureTimeline from './SignatureTimeline';
import SignedDocumentCard from './SignedDocumentCard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface SignatureTabProps {
  contratId: string;
  contratStatut: string;
  onOpenSendDialog: () => void;
}

export default function SignatureTab({ contratId, contratStatut, onOpenSendDialog }: SignatureTabProps) {
  const { data: request, isLoading } = useSignatureRequest(contratId);
  const { data: events = [] } = useSignatureEvents(request?.id);
  const remind = useRemindSignature();
  const cancel = useCancelSignature();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isCompleted = request?.status === 'completed';
  const isActive = request && ['sent', 'viewed', 'signed'].includes(request.status);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Chargement…</CardContent>
      </Card>
    );
  }

  if (!request) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileSignature className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Aucune demande de signature</p>
          <p className="text-sm text-muted-foreground mb-4">
            Lancez une signature électronique via DocuSeal pour ce contrat.
          </p>
          <Button onClick={onOpenSendDialog}>
            <Send className="h-4 w-4 mr-2" />
            Demander une signature
          </Button>
        </CardContent>
      </Card>
    );
  }

  const signers = (request.signers ?? []) as SignatureSigner[];

  return (
    <div className="space-y-4">
      {/* Statut global */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSignature className="h-4 w-4" />
                Demande de signature
                <Badge className={SIGNATURE_STATUS_COLORS[request.status]}>
                  {SIGNATURE_STATUS_LABELS[request.status]}
                </Badge>
              </CardTitle>
              <CardDescription>
                Provider : DocuSeal · Créée {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: fr })}
                {request.expire_at && (
                  <> · Expire le {format(new Date(request.expire_at), 'dd/MM/yyyy', { locale: fr })}</>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {request.provider_url && isActive && (
                <Button variant="outline" size="sm" asChild>
                  <a href={request.provider_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ouvrir DocuSeal
                  </a>
                </Button>
              )}
              {isActive && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => remind.mutate({ requestId: request.id })}
                    disabled={remind.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Relancer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setConfirmCancel(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </>
              )}
              {!isActive && !isCompleted && (
                <Button size="sm" onClick={onOpenSendDialog}>
                  <Send className="h-4 w-4 mr-2" />
                  Nouvelle demande
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm font-medium">Signataires ({signers.length})</p>
            <div className="space-y-2">
              {signers.map((s, i) => (
                <div key={`${s.email}-${i}`} className="flex items-center justify-between rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.email}{s.role ? ` · ${s.role}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.signed_at ? (
                      <Badge className="bg-green-100 text-green-700">
                        Signé {formatDistanceToNow(new Date(s.signed_at), { addSuffix: true, locale: fr })}
                      </Badge>
                    ) : s.status === 'viewed' ? (
                      <Badge className="bg-amber-100 text-amber-700">Consulté</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" /> En attente
                      </Badge>
                    )}
                    {isActive && !s.signed_at && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remind.mutate({ requestId: request.id, signerEmail: s.email })}
                        disabled={remind.isPending}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {request.reminders_sent > 0 && (
              <p className="text-xs text-muted-foreground">
                {request.reminders_sent} relance(s) envoyée(s)
                {request.last_reminder_at && ` · dernière ${formatDistanceToNow(new Date(request.last_reminder_at), { addSuffix: true, locale: fr })}`}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document signé */}
      {isCompleted && request.signed_document_path && (
        <SignedDocumentCard
          path={request.signed_document_path}
          documentHash={request.document_hash}
          completedAt={request.completed_at}
        />
      )}

      {/* Timeline */}
      <SignatureTimeline events={events} />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Annuler la demande de signature ?"
        description="Les signataires ne pourront plus signer. Cette action est irréversible."
        onConfirm={() => cancel.mutate({ requestId: request.id })}
        loading={cancel.isPending}
      />
    </div>
  );
}
