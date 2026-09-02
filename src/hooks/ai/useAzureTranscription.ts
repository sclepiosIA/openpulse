import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import { useToast } from '@/hooks/shared/use-toast';
import type { TranscriptionSegment, TranscriptionParticipant } from '@/types/transcription';

interface UseAzureTranscriptionOptions {
  sessionId: string;
  userId: string;
  displayName: string;
  language?: string;
  onSegment?: (segment: TranscriptionSegment) => void;
}

interface TranscriptionState {
  isRecording: boolean;
  isConnecting: boolean;
  segments: TranscriptionSegment[];
  participants: TranscriptionParticipant[];
  currentText: string;
  error: string | null;
  azureConfigured: boolean;
}

// Intervalle d'enregistrement en ms - fichiers complets de 10s
const RECORDING_INTERVAL_MS = 10000;

export function useAzureTranscription(options: UseAzureTranscriptionOptions) {
  const { sessionId, userId, displayName, language = 'fr', onSegment } = options;
  const { toast } = useToast();

  const [state, setState] = useState<TranscriptionState>({
    isRecording: false,
    isConnecting: false,
    segments: [],
    participants: [],
    currentText: '',
    error: null,
    azureConfigured: true, // Optimistic, updated on first error
  });

  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const sessionStartTimeRef = useRef<number>(0);

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

  // Process a complete audio file and send to Azure
  const processCompleteAudio = useCallback(async (blob: Blob) => {
    try {
      // Skip if too small (silence or empty)
      if (blob.size < 5000) {
        debug.log(`Audio too small (${blob.size} bytes), skipping`);
        return;
      }

      debug.log(`Processing complete audio: ${blob.size} bytes`);

      const base64 = await blobToBase64(blob);

      const { data, error } = await supabase.functions.invoke('azure-transcribe-audio', {
        body: {
          audio: base64,
          sessionId,
          userId,
          speakerName: displayName,
          language,
        },
      });

      if (error) {
        debug.error('Transcription API error:', error);
        return;
      }

      // Handle Azure not configured
      if (data?.configured === false) {
        debug.warn('Azure transcription not configured:', data.error);
        setState(prev => ({ ...prev, azureConfigured: false }));
        return;
      }

      // Handle invalid audio format
      if (data?.success === false && data?.error) {
        debug.warn('Audio processing failed:', data.error);
        return;
      }

      if (data?.success && data?.text) {
        debug.log(`Transcription result: "${data.text.substring(0, 50)}..."`);
        setState(prev => ({
          ...prev,
          currentText: data.text,
        }));
      }
    } catch (err) {
      if (import.meta.env.DEV) debug.error('[AzureTranscription] Error processing audio:', err);
      setState(prev => ({ ...prev, error: err instanceof Error ? err.message : 'Audio processing error' }));
    }
  }, [sessionId, userId, displayName, language, blobToBase64]);

  // Record a single complete segment
  const recordSegment = useCallback((stream: MediaStream) => {
    if (!isRecordingRef.current) return;

    // Determine best supported MIME type
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

    debug.log(`Starting new recording segment with MIME: ${mimeType}`);

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = async () => {
      // Create a complete audio file with proper headers
      const completeBlob = new Blob(chunks, { type: mimeType });
      debug.log(`Segment complete: ${completeBlob.size} bytes`);

      // Process this complete audio file
      if (completeBlob.size > 5000) {
        await processCompleteAudio(completeBlob);
      }

      // Continue recording if still active
      if (isRecordingRef.current && streamRef.current) {
        recordSegment(streamRef.current);
      }
    };

    recorder.onerror = (e) => {
      debug.error('MediaRecorder error:', e);
    };

    // Start recording
    recorder.start();

    // Stop after interval to get a complete file
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, RECORDING_INTERVAL_MS);
  }, [processCompleteAudio]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;
      isRecordingRef.current = true;

      sessionStartTimeRef.current = Date.now();

      // Start the first recording segment
      recordSegment(stream);

      // Update participant status
      await supabase.functions.invoke('visio-transcription-session', {
        body: {
          action: 'update-transcribing',
          sessionId,
          userId,
          isTranscribing: true,
        },
      });

      setState(prev => ({
        ...prev,
        isRecording: true,
        isConnecting: false,
      }));

      toast({
        title: 'Transcription démarrée',
        description: 'Votre voix est maintenant transcrite en temps réel.',
      });

    } catch (err: unknown) {
      debug.error('Error starting recording:', err);
      isRecordingRef.current = false;
      
      let errorMessage = 'Impossible de démarrer la transcription';
      const errObj = err instanceof Error ? err : null;
      if (errObj?.name === 'NotAllowedError') {
        errorMessage = 'Accès au microphone refusé. Veuillez autoriser l\'accès.';
      } else if (errObj?.name === 'NotFoundError') {
        errorMessage = 'Aucun microphone trouvé.';
      }

      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage,
      }));

      toast({
        title: 'Erreur',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [sessionId, userId, recordSegment, toast]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    // Stop recording flag first to prevent new segments
    isRecordingRef.current = false;

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Update participant status
    await supabase.functions.invoke('visio-transcription-session', {
      body: {
        action: 'update-transcribing',
        sessionId,
        userId,
        isTranscribing: false,
      },
    });

    setState(prev => ({
      ...prev,
      isRecording: false,
      currentText: '',
    }));

    toast({
      title: 'Transcription arrêtée',
      description: 'Votre microphone a été désactivé.',
    });
  }, [sessionId, userId, toast]);

  // Subscribe to realtime segments
  useEffect(() => {
    const channel = supabase
      .channel(`transcription-segments:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'visio_transcription_segments',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newSegment = payload.new as TranscriptionSegment;
          setState(prev => ({
            ...prev,
            segments: [...prev.segments, newSegment],
          }));
          onSegment?.(newSegment);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, onSegment]);

  // Subscribe to realtime participants
  useEffect(() => {
    // Fetch initial participants
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('visio_transcription_participants')
        .select('id, session_id, user_id, display_name, joined_at, left_at, is_transcribing')
        .eq('session_id', sessionId);
      
      if (data) {
        setState(prev => ({ ...prev, participants: data as TranscriptionParticipant[] }));
      }
    };
    fetchParticipants();

    const channel = supabase
      .channel(`transcription-participants:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visio_transcription_participants',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setState(prev => ({
              ...prev,
              participants: [...prev.participants, payload.new as TranscriptionParticipant],
            }));
          } else if (payload.eventType === 'UPDATE') {
            setState(prev => ({
              ...prev,
              participants: prev.participants.map(p =>
                p.id === payload.new.id ? payload.new as TranscriptionParticipant : p
              ),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
  };
}
