/**
 * CallWidget — softphone flottant global (desktop only).
 *
 * Pattern aligné sur PulseFloatingChat : widget bottom-right, masqué sur mobile
 * et routes publiques. Monté une seule fois dans App pour conserver la session SIP.
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Phone, PhoneOff, Mic, MicOff, X, Circle, Loader2, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCallContext } from '@/contexts/CallContext';
import { useSipClient } from '@/hooks/voice/useSipClient';
import { logCallAction, uploadCallRecording } from '@/hooks/voice/useCalls';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const PUBLIC_ROUTE_PREFIXES = ['/m/', '/utilisateurs', '/dpo-exemple', '/auth'];

export function CallWidget() {
  const location = useLocation();
  const isHidden = useMemo(
    () => PUBLIC_ROUTE_PREFIXES.some((p) => location.pathname.startsWith(p)),
    [location.pathname],
  );

  const { isOpen, pendingTarget, closeWidget, consumeTarget } = useCallContext();
  const sip = useSipClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [callId, setCallId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);

  // Démarre l'appel quand un target est posé
  useEffect(() => {
    if (!isOpen) return;
    const target = consumeTarget();
    if (!target) return;

    (async () => {
      try {
        if (sip.state !== 'registered') await sip.connect();
        const { call_id } = await logCallAction({
          action: 'start',
          direction: 'outbound',
          to_number: target.phoneNumber,
          display_name: target.displayName,
          contact_id: target.contactId,
          etablissement_id: target.etablissementId,
          prospect_id: target.prospectId,
        });
        if (call_id) setCallId(call_id);
        await sip.startCall(target.phoneNumber, target.displayName);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        toast({ title: 'Appel impossible', description: msg, variant: 'destructive' });
        closeWidget();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Audio remote stream
  useEffect(() => {
    if (audioRef.current && sip.remoteStream) {
      audioRef.current.srcObject = sip.remoteStream;
      audioRef.current.play().catch(() => { /* autoplay block */ });
    }
  }, [sip.remoteStream]);

  // Timer durée
  useEffect(() => {
    if (sip.call?.state === 'connected' && sip.call.answeredAt) {
      const start = sip.call.answeredAt;
      const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
      return () => clearInterval(id);
    }
    setElapsed(0);
  }, [sip.call?.state, sip.call?.answeredAt]);

  // Démarre enregistrement à la connexion
  useEffect(() => {
    if (sip.call?.state === 'connected' && !recorderRef.current && sip.remoteStream) {
      const rec = sip.startRecording();
      if (rec) {
        recordedChunksRef.current = [];
        rec.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        recorderRef.current = rec;
        // Logger answer
        if (callId) logCallAction({ action: 'answer', call_id: callId }).catch(() => {});
      }
    }
  }, [sip.call?.state, sip.remoteStream, callId, sip]);

  // Fin d'appel : upload + log
  useEffect(() => {
    if (!sip.call) return;
    if (sip.call.state === 'ended' || sip.call.state === 'failed') {
      (async () => {
        const recorder = recorderRef.current;
        let recordingPath: string | null = null;
        if (recorder && recorder.state !== 'inactive') {
          await new Promise<void>((res) => {
            recorder.onstop = () => res();
            recorder.stop();
          });
        }
        if (callId && recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          if (blob.size > 1024) {
            recordingPath = await uploadCallRecording(callId, blob).catch(() => null);
          }
        }
        if (callId) {
          await logCallAction({
            action: sip.call?.state === 'failed' ? 'fail' : 'end',
            call_id: callId,
            duration_sec: elapsed,
            notes: notes || undefined,
            recording_path: recordingPath || undefined,
            status: sip.call?.state === 'failed' ? 'failed' : 'completed',
          }).catch(() => {});
        }
        recorderRef.current = null;
        recordedChunksRef.current = [];
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sip.call?.state]);

  if (isHidden || !isOpen) return null;

  const target = sip.call;
  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleHangup = () => {
    sip.hangup();
    setTimeout(() => closeWidget(), 600);
  };

  const dtmfKeys = ['1','2','3','4','5','6','7','8','9','*','0','#'];

  return (
    <div className="hidden md:block fixed bottom-6 right-6 z-50 w-80">
      <Card className="shadow-2xl border-2 border-primary/20 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Phone className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {target?.displayName || target?.remote || 'Appel'}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {target?.remote && target?.remote !== target?.displayName ? target.remote : ''}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleHangup} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant={
              target?.state === 'connected' ? 'default' :
              target?.state === 'failed' || target?.state === 'ended' ? 'destructive' : 'secondary'
            }>
              {target?.state === 'connected' && (<><Circle className="h-2 w-2 mr-1 fill-current animate-pulse" /> En cours</>)}
              {target?.state === 'progress' && (<><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Connexion…</>)}
              {target?.state === 'ringing' && (<><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sonnerie</>)}
              {target?.state === 'ended' && 'Terminé'}
              {target?.state === 'failed' && 'Échec'}
              {!target && (<><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Initialisation</>)}
            </Badge>
            {target?.state === 'connected' && (
              <span className="text-sm font-mono tabular-nums">{formatDuration(elapsed)}</span>
            )}
          </div>

          {sip.error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
              {sip.error}
            </div>
          )}

          <Textarea
            placeholder="Notes d'appel (sauvegardées à la fin)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />

          {showKeypad && (
            <div className="grid grid-cols-3 gap-1">
              {dtmfKeys.map((k) => (
                <Button key={k} variant="outline" size="sm" onClick={() => sip.sendDtmf(k)}>{k}</Button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <Button
              variant={sip.isMuted ? 'default' : 'outline'}
              size="icon"
              onClick={() => sip.toggleMute()}
              disabled={target?.state !== 'connected'}
              title={sip.isMuted ? 'Réactiver micro' : 'Couper micro'} aria-label="Couper le micro">
              {sip.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowKeypad((v) => !v)}
              disabled={target?.state !== 'connected'}
              title="Clavier DTMF" aria-label="Tag">
              <Hash className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={handleHangup}
              className={cn('h-12 w-12 rounded-full', target?.state === 'connected' && 'animate-none')}
              title="Raccrocher" aria-label="Raccrocher">
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      </Card>
    </div>
  );
}
