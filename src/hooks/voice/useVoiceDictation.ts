import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/shared/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';

interface UseVoiceDictationOptions {
  onTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  language?: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
  onstart: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useVoiceDictation({
  onTranscript,
  onInterimTranscript,
  language = 'fr-FR',
}: UseVoiceDictationOptions) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Check if Web Speech API is available
  const isWebSpeechSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  
  // Audio level monitoring
  const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  }, []);
  
  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);
  
  // Start recording with Web Speech API
  const startWebSpeech = useCallback(() => {
    if (!isWebSpeechSupported) {
      setError('Web Speech API non supporté');
      return false;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    
    recognition.onstart = () => {
      debug.log('[VoiceDictation] Started');
      setIsRecording(true);
      setError(null);
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      if (interimTranscript && onInterimTranscript) {
        onInterimTranscript(interimTranscript);
      }
      
      if (finalTranscript) {
        onTranscript(finalTranscript);
      }
    };
    
    recognition.onerror = (event: { error: string }) => {
      debug.error('[VoiceDictation] Error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Permission micro refusée');
        toast({
          title: 'Permission refusée',
          description: 'Autorisez l\'accès au microphone pour la dictée vocale',
          variant: 'destructive',
        });
      } else if (event.error !== 'aborted') {
        setError(event.error);
      }
      setIsRecording(false);
    };
    
    recognition.onend = () => {
      debug.log('[VoiceDictation] Ended');
      setIsRecording(false);
    };
    
    recognitionRef.current = recognition;
    recognition.start();
    
    // Also start audio level monitoring
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        startAudioLevelMonitoring(stream);
      })
      .catch(err => debug.error('[VoiceDictation] Audio level error:', err));
    
    return true;
  }, [isWebSpeechSupported, language, onTranscript, onInterimTranscript, toast, startAudioLevelMonitoring]);
  
  // Stop Web Speech recording
  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    stopAudioLevelMonitoring();
    setIsRecording(false);
  }, [stopAudioLevelMonitoring]);
  
  // Fallback: Record audio and send to Whisper API
  const startWhisperRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect chunks every second
      
      setIsRecording(true);
      setError(null);
      startAudioLevelMonitoring(stream);
      
      return true;
    } catch (err: unknown) {
      debug.error('[VoiceDictation] Whisper recording error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur d\'accès au micro';
      setError(errorMessage);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'accéder au microphone',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, startAudioLevelMonitoring]);
  
  // Stop Whisper recording and transcribe
  const stopWhisperRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    
    setIsProcessing(true);
    
    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType 
        });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          try {
            const { data, error } = await supabase.functions.invoke('transcribe-audio', {
              body: { audio: base64Audio, language },
            });
            
            if (error) throw error;
            
            if (data?.text) {
              onTranscript(data.text);
            }
          } catch (err: unknown) {
            debug.error('[VoiceDictation] Transcription error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Erreur de transcription';
            setError(errorMessage);
            toast({
              title: 'Erreur de transcription',
              description: errorMessage,
              variant: 'destructive',
            });
          } finally {
            setIsProcessing(false);
            resolve();
          }
        };
        
        reader.readAsDataURL(audioBlob);
      };
      
      mediaRecorder.stop();
      mediaRecorderRef.current = null;
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      stopAudioLevelMonitoring();
      setIsRecording(false);
    });
  }, [language, onTranscript, toast, stopAudioLevelMonitoring]);
  
  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      if (isWebSpeechSupported) {
        stopWebSpeech();
      } else {
        stopWhisperRecording();
      }
    } else {
      if (isWebSpeechSupported) {
        startWebSpeech();
      } else {
        startWhisperRecording();
      }
    }
  }, [isRecording, isWebSpeechSupported, stopWebSpeech, stopWhisperRecording, startWebSpeech, startWhisperRecording]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebSpeech();
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [stopWebSpeech]);
  
  return {
    isRecording,
    isProcessing,
    error,
    audioLevel,
    isSupported: isWebSpeechSupported || true, // Whisper fallback always available
    toggleRecording,
    startRecording: isWebSpeechSupported ? startWebSpeech : startWhisperRecording,
    stopRecording: isWebSpeechSupported ? stopWebSpeech : stopWhisperRecording,
  };
}
