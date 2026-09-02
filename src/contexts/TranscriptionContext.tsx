import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useToast } from '@/hooks/shared/use-toast';
import { debug } from '@/lib/debug';
import type { TranscriptionSession, TranscriptionSegment, TranscriptionParticipant } from '@/types/transcription';

interface StartSessionOptions {
  title: string;
  roomCode?: string;
  externalMeetingUrl?: string;
  provider?: 'marque_meet' | 'google_meet' | 'teams' | 'zoom' | 'other';
  etablissementId?: string;
  partenaireId?: string;
  groupeId?: string;
  conversationId?: string;
  autoRecord?: boolean;
}

interface TranscriptionContextType {
  // Session active
  activeSession: TranscriptionSession | null;
  isSessionActive: boolean;
  
  // Actions session
  startSession: (options: StartSessionOptions) => Promise<TranscriptionSession | null>;
  joinSession: (sessionId: string) => Promise<void>;
  endSession: () => Promise<void>;
  
  // État enregistrement
  isRecording: boolean;
  isConnecting: boolean;
  toggleRecording: () => void;
  
  // Mode étendu (capte audio système + micro)
  isExtendedMode: boolean;
  toggleExtendedMode: () => void;
  
  // Données temps réel
  segments: TranscriptionSegment[];
  participants: TranscriptionParticipant[];
  currentText: string;
  
  // Erreurs
  error: string | null;
}

const TranscriptionContext = createContext<TranscriptionContextType | undefined>(undefined);

export function TranscriptionProvider({ children }: { children: ReactNode }) {
  const { data: profile } = useCurrentProfile();
  const { toast } = useToast();
  
  // Session state
  const [activeSession, setActiveSession] = useState<TranscriptionSession | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [participants, setParticipants] = useState<TranscriptionParticipant[]>([]);
  const [currentText, setCurrentText] = useState('');
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExtendedMode, setIsExtendedMode] = useState(true); // Activé par défaut - capture audio système + micro
  const [error, setError] = useState<string | null>(null);
  
  // Refs for media
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [processInterval, setProcessInterval] = useState<number | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  
  const displayName = profile
    ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() || profile.email || 'Anonyme'
    : 'Anonyme';

  // Helper to convert blob to base64
  const blobToBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  // Process audio chunks
  const processChunks = useCallback(async (chunks: Blob[], sessionId: string) => {
    if (chunks.length === 0) return;
    
    if (!profile?.id) {
      debug.warn('[Transcription] Skipping chunk processing: profile not loaded');
      return;
    }

    try {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      if (blob.size < 1000) return; // Skip tiny chunks

      const base64 = await blobToBase64(blob);

      const { data, error: fnError } = await supabase.functions.invoke('azure-transcribe-audio', {
        body: {
          audio: base64,
          sessionId,
          userId: profile.id,
          speakerName: displayName,
          language: 'fr',
        },
      });

      if (fnError) {
        debug.error('Transcription error:', fnError);
        return;
      }

      // Handle non-configured Azure (graceful degradation)
      if (data?.configured === false) {
        debug.warn('Azure transcription not configured:', data.error);
        return;
      }

      if (data?.success && data?.text) {
        setCurrentText(data.text);
      }
    } catch (err) {
      debug.error('Error processing audio:', err);
    }
  }, [profile?.id, displayName, blobToBase64]);

  // Start session
  const startSession = useCallback(async (options: StartSessionOptions): Promise<TranscriptionSession | null> => {
    if (!profile?.id) {
      toast({
        title: 'Erreur',
        description: 'Vous devez être connecté pour démarrer une transcription.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('visio-transcription-session', {
        body: {
          action: 'create',
          userId: profile.id,
          displayName,
          title: options.title,
          roomCode: options.roomCode,
          externalMeetingUrl: options.externalMeetingUrl,
          etablissementId: options.etablissementId,
          partenaireId: options.partenaireId,
          groupeId: options.groupeId,
          conversationId: options.conversationId,
        },
      });

      if (fnError || !data?.success) {
        throw new Error(fnError?.message || 'Failed to create session');
      }

      const session = data.session as TranscriptionSession;
      setActiveSession(session);
      setSegments([]);
      setParticipants(data.participant ? [data.participant] : []);

      toast({
        title: 'Session créée',
        description: 'La transcription est prête à démarrer.',
      });

      // Auto-start recording if requested
      if (options.autoRecord) {
        setTimeout(() => startRecordingInternal(session.id), 500);
      }

      return session;
    } catch (err: unknown) {
      debug.error('Error creating session:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la session de transcription.',
        variant: 'destructive',
      });
      return null;
    }
  }, [profile?.id, displayName, toast]);

  // Join existing session
  const joinSession = useCallback(async (sessionId: string) => {
    if (!profile?.id) return;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('visio-transcription-session', {
        body: {
          action: 'join',
          sessionId,
          userId: profile.id,
          displayName,
        },
      });

      if (fnError || !data?.success) {
        throw new Error(fnError?.message || 'Failed to join session');
      }

      setActiveSession(data.session);
      setParticipants(data.session.participants || []);
      setSegments(data.session.segments || []);

      toast({
        title: 'Session rejointe',
        description: 'Vous avez rejoint la transcription.',
      });
    } catch (err: unknown) {
      debug.error('Error joining session:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de rejoindre la session.',
        variant: 'destructive',
      });
    }
  }, [profile?.id, displayName, toast]);

  // End session
  const endSession = useCallback(async () => {
    if (!activeSession || !profile?.id) return;

    try {
      // Stop recording first
      if (isRecording) {
        await stopRecordingInternal();
      }

      const { data, error: fnError } = await supabase.functions.invoke('visio-transcription-session', {
        body: {
          action: 'end',
          sessionId: activeSession.id,
          userId: profile.id,
        },
      });

      if (fnError) {
        debug.error('Error ending session:', fnError);
      }

      setActiveSession(null);
      setSegments([]);
      setParticipants([]);
      setCurrentText('');

      toast({
        title: 'Session terminée',
        description: 'Le résumé IA est en cours de génération.',
      });
    } catch (err: unknown) {
      debug.error('Error ending session:', err);
    }
  }, [activeSession, profile?.id, isRecording, toast]);

  // Start recording (internal)
  const startRecordingInternal = useCallback(async (sessionId: string) => {
    // Check profile is loaded before starting recording
    if (!profile?.id) {
      debug.error('[Transcription] Cannot start recording: profile not loaded');
      toast({
        title: 'Erreur',
        description: 'Profil en cours de chargement, veuillez réessayer.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      let stream: MediaStream;

      if (isExtendedMode) {
        // Mode étendu: capture audio système + micro
        try {
          // Request display media for system audio
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: false,
          });

          // Request microphone
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 16000,
            },
          });

          // Mix both streams
          const ctx = new AudioContext();
          const destination = ctx.createMediaStreamDestination();

          const systemSource = ctx.createMediaStreamSource(displayStream);
          const micSource = ctx.createMediaStreamSource(micStream);

          // Create gain nodes for volume control
          const systemGain = ctx.createGain();
          const micGain = ctx.createGain();
          
          systemGain.gain.value = 1.0;
          micGain.gain.value = 1.0;

          systemSource.connect(systemGain).connect(destination);
          micSource.connect(micGain).connect(destination);

          stream = destination.stream;
          setAudioContext(ctx);

          // Store streams for cleanup
          (stream as MediaStream & { _displayStream?: MediaStream; _micStream?: MediaStream })._displayStream = displayStream;
          (stream as MediaStream & { _displayStream?: MediaStream; _micStream?: MediaStream })._micStream = micStream;

        } catch (displayError: any) {
          // Fallback to mic only if user cancels screen share
          debug.warn('Extended mode failed, falling back to mic:', displayError);
          
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 16000,
            },
          });
          
          toast({
            title: 'Mode standard activé',
            description: 'Seul votre microphone sera transcrit.',
          });
        }
      } else {
        // Mode standard: micro uniquement
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
        });
      }

      setAudioStream(stream);

      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      // Keep ALL chunks to maintain valid WebM structure
      // The first chunk contains the EBML header, subsequent ones are data clusters
      const allChunks: Blob[] = [];
      let lastProcessedIndex = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          allChunks.push(e.data);
        }
      };

      recorder.start(5000); // 5 second chunks
      setMediaRecorder(recorder);

      // Process accumulated chunks every 5 seconds
      // Always include all chunks from the beginning to have a valid WebM file
      const intervalId = window.setInterval(() => {
        if (allChunks.length > lastProcessedIndex) {
          // Create a complete WebM blob from all accumulated chunks
          const completeBlob = new Blob(allChunks, { type: 'audio/webm' });
          lastProcessedIndex = allChunks.length;
          
          // Only process if we have meaningful content
          if (completeBlob.size > 5000) {
            processChunks([completeBlob], sessionId);
          }
        }
      }, 8000); // Process every 8 seconds for more complete audio
      setProcessInterval(intervalId);

      // Update participant status
      await supabase.functions.invoke('visio-transcription-session', {
        body: {
          action: 'update-transcribing',
          sessionId,
          userId: profile.id,
          isTranscribing: true,
        },
      });

      setIsRecording(true);
      setIsConnecting(false);

      toast({
        title: 'Transcription démarrée',
        description: isExtendedMode 
          ? 'Audio système et microphone capturés.' 
          : 'Votre voix est transcrite en temps réel.',
      });

    } catch (err: unknown) {
      debug.error('Error starting recording:', err);
      
      let errorMessage = 'Impossible de démarrer la transcription';
      const errObj = err instanceof Error ? err : null;
      if (errObj?.name === 'NotAllowedError') {
        errorMessage = 'Accès au microphone refusé.';
      } else if (errObj?.name === 'NotFoundError') {
        errorMessage = 'Aucun microphone trouvé.';
      }

      setError(errorMessage);
      setIsConnecting(false);

      toast({
        title: 'Erreur',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [profile?.id, isExtendedMode, processChunks, toast]);

  // Stop recording (internal)
  const stopRecordingInternal = useCallback(async () => {
    // Stop interval
    if (processInterval) {
      clearInterval(processInterval);
      setProcessInterval(null);
    }

    // Stop MediaRecorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setMediaRecorder(null);

    // Stop streams
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      
      // Also stop the original streams if in extended mode
      const extended = audioStream as MediaStream & { _displayStream?: MediaStream; _micStream?: MediaStream };
      const displayStream = extended._displayStream;
      const micStream = extended._micStream;
      
      if (displayStream) {
        displayStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (micStream) {
        micStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      
      setAudioStream(null);
    }

    // Close audio context
    if (audioContext) {
      await audioContext.close();
      setAudioContext(null);
    }

    // Update participant status
    if (activeSession && profile?.id) {
      await supabase.functions.invoke('visio-transcription-session', {
        body: {
          action: 'update-transcribing',
          sessionId: activeSession.id,
          userId: profile.id,
          isTranscribing: false,
        },
      });
    }

    setIsRecording(false);
    setCurrentText('');

    toast({
      title: 'Transcription arrêtée',
      description: 'Le microphone a été désactivé.',
    });
  }, [processInterval, mediaRecorder, audioStream, audioContext, activeSession, profile?.id, toast]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecordingInternal();
    } else if (activeSession) {
      startRecordingInternal(activeSession.id);
    }
  }, [isRecording, activeSession, startRecordingInternal, stopRecordingInternal]);

  // Toggle extended mode
  const toggleExtendedMode = useCallback(() => {
    if (isRecording) {
      toast({
        title: 'Action impossible',
        description: 'Arrêtez la transcription pour changer de mode.',
        variant: 'destructive',
      });
      return;
    }
    setIsExtendedMode(prev => !prev);
  }, [isRecording, toast]);

  // Subscribe to realtime segments
  useEffect(() => {
    if (!activeSession) return;

    const channel = supabase
      .channel(`transcription-segments:${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'visio_transcription_segments',
          filter: `session_id=eq.${activeSession.id}`,
        },
        (payload) => {
          const newSegment = payload.new as TranscriptionSegment;
          setSegments(prev => [...prev, newSegment]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  // Subscribe to realtime participants
  useEffect(() => {
    if (!activeSession) return;

    const channel = supabase
      .channel(`transcription-participants:${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visio_transcription_participants',
          filter: `session_id=eq.${activeSession.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setParticipants(prev => [...prev, payload.new as TranscriptionParticipant]);
          } else if (payload.eventType === 'UPDATE') {
            setParticipants(prev =>
              prev.map(p => (p.id === payload.new.id ? (payload.new as TranscriptionParticipant) : p))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processInterval) {
        clearInterval(processInterval);
      }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, []);

  const value: TranscriptionContextType = {
    activeSession,
    isSessionActive: !!activeSession,
    startSession,
    joinSession,
    endSession,
    isRecording,
    isConnecting,
    toggleRecording,
    isExtendedMode,
    toggleExtendedMode,
    segments,
    participants,
    currentText,
    error,
  };

  return (
    <TranscriptionContext.Provider value={value}>
      {children}
    </TranscriptionContext.Provider>
  );
}

// Safe fallback when provider is not yet mounted (deferred initialization)
const FALLBACK_VALUE: TranscriptionContextType = {
  activeSession: null,
  isSessionActive: false,
  startSession: async () => null,
  joinSession: async () => {},
  endSession: async () => {},
  isRecording: false,
  isConnecting: false,
  toggleRecording: () => {},
  isExtendedMode: false,
  toggleExtendedMode: () => {},
  segments: [],
  participants: [],
  currentText: '',
  error: null,
};

export function useTranscription() {
  const context = useContext(TranscriptionContext);
  if (context === undefined) {
    return FALLBACK_VALUE;
  }
  return context;
}
