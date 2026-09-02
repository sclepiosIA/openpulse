/**
 * useSipClient — wrapper JsSIP (SIP/WebRTC) lazy-loadé.
 *
 * Architecture : isolation totale du SDK SIP derrière une API simple
 * (call/hangup/answer/sendDtmf/mute) pour faciliter un éventuel pivot
 * vers Linphone SDK ou autre moteur.
 *
 * Sécurité : les credentials sont fetchés via l'edge `sip-credentials`
 * (jamais en localStorage), TTL navigateur uniquement.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SipCredentials } from '@/types/calls';

export type SipState = 'idle' | 'connecting' | 'registered' | 'failed';
export type SipCallState = 'idle' | 'progress' | 'ringing' | 'connected' | 'ended' | 'failed';

interface SipCallInfo {
  id: string | null;
  remote: string;
  displayName?: string;
  direction: 'outbound' | 'inbound';
  startedAt: number;
  answeredAt: number | null;
  state: SipCallState;
}

interface UseSipClientReturn {
  state: SipState;
  call: SipCallInfo | null;
  remoteStream: MediaStream | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  startCall: (phoneNumber: string, displayName?: string) => Promise<void>;
  answer: () => void;
  hangup: () => void;
  sendDtmf: (tone: string) => void;
  toggleMute: () => boolean;
  isMuted: boolean;
  startRecording: () => MediaRecorder | null;
}

// Typage minimal pour JsSIP. La lib expose ses propres types stricts, mais
// nos callbacks emploient ici des unions partielles : on garde une signature
// permissive (`unknown`) et on caste localement avec ces interfaces.
interface JsSipSession {
  id?: string;
  remote_identity?: { uri?: { user?: string }; display_name?: string };
  on: <E = unknown>(event: string, cb: (arg: E) => void) => void;
  terminate?: () => void;
  answer: (opts: unknown) => void;
  sendDTMF: (tone: string) => void;
  isMuted?: () => { audio: boolean };
  mute: (opts: { audio: boolean }) => void;
  unmute: (opts: { audio: boolean }) => void;
}
interface JsSipUA {
  on: <E = unknown>(event: string, cb: (arg: E) => void) => void;
  start: () => void;
  stop?: () => void;
  call: (target: string, opts: unknown) => void;
}
interface JsSipRtcSessionEvent { session: JsSipSession; originator: 'local' | 'remote' }
interface JsSipFailEvent { cause?: string }
interface JsSipPeerConnEvent { peerconnection: RTCPeerConnection }

export function useSipClient(): UseSipClientReturn {
  const [state, setState] = useState<SipState>('idle');
  const [call, setCall] = useState<SipCallInfo | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const uaRef = useRef<JsSipUA | null>(null);
  const sessionRef = useRef<JsSipSession | null>(null);
  const credsRef = useRef<SipCredentials | null>(null);

  const fetchCredentials = useCallback(async (): Promise<SipCredentials> => {
    const { data, error } = await supabase.functions.invoke('sip-credentials', { body: {} });
    if (error) throw new Error(error.message || 'Échec récupération credentials SIP');
    if (!data?.credentials) throw new Error('Aucune configuration SIP active');
    return data.credentials as SipCredentials;
  }, []);

  const connect = useCallback(async () => {
    if (state === 'registered' || state === 'connecting') return;
    setState('connecting');
    setError(null);

    try {
      const creds = await fetchCredentials();
      credsRef.current = creds;

      // Lazy import JsSIP (évite WASM/bundle au chargement initial)
      const JsSIP = (await import('jssip')).default;

      const wsUri = creds.sip_proxy || `${creds.sip_transport}://${creds.sip_domain}`;
      const socket = new JsSIP.WebSocketInterface(
        wsUri.startsWith('ws') ? wsUri : `wss://${creds.sip_domain}`,
      );

      const uaRaw = new JsSIP.UA({
        sockets: [socket],
        uri: creds.sip_uri || `sip:${creds.sip_username}@${creds.sip_domain}`,
        password: creds.sip_password,
        display_name: creds.caller_id || creds.sip_username,
        register: true,
        session_timers: false,
      });
      const ua = uaRaw as unknown as JsSipUA;

      ua.on('registered', () => {
        setState('registered');
        setError(null);
      });
      ua.on('unregistered', () => setState('idle'));
      ua.on('registrationFailed', (e: JsSipFailEvent) => {
        setState('failed');
        setError(`Enregistrement SIP échoué : ${e?.cause || 'inconnu'}`);
      });

      ua.on('newRTCSession', (data: JsSipRtcSessionEvent) => {
        const session = data.session;
        sessionRef.current = session;
        const direction = data.originator === 'remote' ? 'inbound' : 'outbound';
        const remote = session.remote_identity?.uri?.user || 'inconnu';

        setCall({
          id: session.id || null,
          remote,
          displayName: session.remote_identity?.display_name,
          direction,
          startedAt: Date.now(),
          answeredAt: null,
          state: direction === 'inbound' ? 'ringing' : 'progress',
        });

        session.on('progress', () => setCall((c) => c ? { ...c, state: 'progress' } : c));
        session.on('accepted', () => setCall((c) => c ? { ...c, state: 'connected', answeredAt: Date.now() } : c));
        session.on('confirmed', () => setCall((c) => c ? { ...c, state: 'connected', answeredAt: c.answeredAt || Date.now() } : c));
        session.on('ended', () => {
          setCall((c) => c ? { ...c, state: 'ended' } : c);
          sessionRef.current = null;
        });
        session.on('failed', (ev: JsSipFailEvent) => {
          setCall((c) => c ? { ...c, state: 'failed' } : c);
          setError(ev?.cause || 'Appel échoué');
          sessionRef.current = null;
        });
        session.on('peerconnection', (ev: JsSipPeerConnEvent) => {
          const pc: RTCPeerConnection = ev.peerconnection;
          pc.addEventListener('track', (te) => {
            if (te.streams && te.streams[0]) setRemoteStream(te.streams[0]);
          });
        });
      });

      ua.start();
      uaRef.current = ua;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg);
      setState('failed');
    }
  }, [fetchCredentials, state]);

  const disconnect = useCallback(() => {
    try {
      sessionRef.current?.terminate?.();
    } catch { /* noop */ }
    try {
      (uaRef.current as JsSipUA | null)?.stop?.();
    } catch { /* noop */ }
    uaRef.current = null;
    sessionRef.current = null;
    setCall(null);
    setRemoteStream(null);
    setState('idle');
  }, []);

  const startCall = useCallback(async (phoneNumber: string, displayName?: string) => {
    if (!uaRef.current) await connect();
    const ua = uaRef.current as JsSipUA | null;
    if (!ua) throw new Error('SIP non connecté');
    const creds = credsRef.current;
    if (!creds) throw new Error('Credentials manquants');

    const target = phoneNumber.includes('@')
      ? phoneNumber
      : `sip:${phoneNumber.replace(/[^\d+*#]/g, '')}@${creds.sip_domain}`;

    ua.call(target, {
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });
    if (displayName) {
      setCall((c) => c ? { ...c, displayName } : c);
    }
  }, [connect]);

  const answer = useCallback(() => {
    sessionRef.current?.answer({
      mediaConstraints: { audio: true, video: false },
    });
  }, []);

  const hangup = useCallback(() => {
    try { sessionRef.current?.terminate?.(); } catch { /* noop */ }
  }, []);

  const sendDtmf = useCallback((tone: string) => {
    try { sessionRef.current?.sendDTMF(tone); } catch { /* noop */ }
  }, []);

  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return false;
    if (session.isMuted?.().audio) {
      session.unmute({ audio: true });
      setIsMuted(false);
      return false;
    }
    session.mute({ audio: true });
    setIsMuted(true);
    return true;
  }, []);

  const startRecording = useCallback((): MediaRecorder | null => {
    if (!remoteStream) return null;
    try {
      const recorder = new MediaRecorder(remoteStream, { mimeType: 'audio/webm' });
      recorder.start();
      return recorder;
    } catch (e) {
      console.warn('[useSipClient] MediaRecorder failed:', e);
      return null;
    }
  }, [remoteStream]);

  // Cleanup à l'unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state, call, remoteStream, error,
    connect, disconnect, startCall, answer, hangup,
    sendDtmf, toggleMute, isMuted, startRecording,
  };
}
