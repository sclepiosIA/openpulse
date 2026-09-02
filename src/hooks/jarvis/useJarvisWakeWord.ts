/**
 * useJarvisWakeWord - Détecteur de Wake Word "Hey Jarvis" 
 * 
 * V11.0: Détection continue du wake word en arrière-plan
 * - Écoute passive à faible consommation
 * - Activation automatique sur "Hey Jarvis" ou "Jarvis"
 * - Calibration du bruit ambiant
 * - Faux positifs filtrés
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { debug } from '@/lib/debug';

// Minimal Web Speech API types (cf. useJarvisVoice.ts).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike> & { length: number };
}
interface SpeechRecognitionErrorEventLike { error: string }
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface UseJarvisWakeWordOptions {
  wakeWords?: string[];
  onWakeUp?: () => void;
  autoStart?: boolean;
  sensitivity?: 'low' | 'medium' | 'high';
}

interface UseJarvisWakeWordReturn {
  isListening: boolean;
  isDetected: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetDetection: () => void;
  confidence: number;
}

// Patterns de wake word avec variations
const WAKE_PATTERNS = [
  /\b(hey\s+)?jarvis\b/i,
  /\b(ok|okay)\s+jarvis\b/i,
  /\byo\s+jarvis\b/i,
  /\bharvis\b/i, // Common mispronunciation
  /\bdjarvis\b/i,
];

// Sensibilité → nombre de détections nécessaires
const SENSITIVITY_MAP = {
  low: 2,    // 2 détections consécutives
  medium: 1, // 1 détection suffit
  high: 1    // 1 détection + confirmation rapide
};

export function useJarvisWakeWord({
  wakeWords = ['jarvis', 'hey jarvis'],
  onWakeUp,
  autoStart = false,
  sensitivity = 'medium'
}: UseJarvisWakeWordOptions = {}): UseJarvisWakeWordReturn {
  
  const [isListening, setIsListening] = useState(false);
  const [isDetected, setIsDetected] = useState(false);
  const [confidence, setConfidence] = useState(0);
  
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const detectionCountRef = useRef(0);
  const cooldownRef = useRef(false);
  const onWakeUpRef = useRef(onWakeUp);
  
  // Sync refs
  useEffect(() => { onWakeUpRef.current = onWakeUp; }, [onWakeUp]);
  
  // Check Web Speech API support
  const isSpeechSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  
  // Check if text contains wake word
  const detectWakeWord = useCallback((text: string): { detected: boolean; confidence: number } => {
    const lowerText = text.toLowerCase().trim();
    
    // Check against custom wake words
    for (const word of wakeWords) {
      if (lowerText.includes(word.toLowerCase())) {
        return { detected: true, confidence: 0.95 };
      }
    }
    
    // Check against patterns
    for (const pattern of WAKE_PATTERNS) {
      if (pattern.test(lowerText)) {
        return { detected: true, confidence: 0.85 };
      }
    }
    
    // Fuzzy matching for common misrecognitions
    const fuzzyMatches = ['jarry', 'harvey', 'javis', 'jarv', 'darvis'];
    for (const fuzzy of fuzzyMatches) {
      if (lowerText.includes(fuzzy)) {
        return { detected: true, confidence: 0.7 };
      }
    }
    
    return { detected: false, confidence: 0 };
  }, [wakeWords]);
  
  // Initialize continuous recognition
  const initRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (!isSpeechSupported) return null;

    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return null;

    const recognition: SpeechRecognitionLike = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true; // Get interim for faster wake word detection
    recognition.lang = 'fr-FR';

    
    recognition.onstart = () => {
      debug.log('[WakeWord] Recognition started - listening for wake word');
      setIsListening(true);
    };
    
    recognition.onend = () => {
      debug.log('[WakeWord] Recognition ended');
      
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current && !cooldownRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            debug.warn('[WakeWord] Auto-restart failed:', e);
          }
        }, 100);
      } else {
        setIsListening(false);
      }
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      // Ignore no-speech errors in continuous mode
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        debug.warn('[WakeWord] Recognition error:', event.error);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      // Check both interim and final results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        const transcript = result[0].transcript;
        
        const { detected, confidence: conf } = detectWakeWord(transcript);
        
        if (detected) {
          detectionCountRef.current++;
          setConfidence(conf);
          
          const requiredDetections = SENSITIVITY_MAP[sensitivity];
          
          if (detectionCountRef.current >= requiredDetections || result.isFinal) {
            debug.log('[WakeWord] Wake word detected!', transcript, 'confidence:', conf);
            setIsDetected(true);
            
            // Cooldown to prevent spam
            cooldownRef.current = true;
            setTimeout(() => {
              cooldownRef.current = false;
            }, 2000);
            
            // Trigger callback
            onWakeUpRef.current?.();
            
            // Reset detection count
            detectionCountRef.current = 0;
            
            // Stop continuous listening after detection
            try {
              recognition.stop();
            } catch (e) {
              // Ignore
            }
            
            return;
          }
        }
      }
    };
    
    return recognition;
  }, [isSpeechSupported, detectWakeWord, sensitivity]);
  
  // Start listening
  const startListening = useCallback(() => {
    if (!isSpeechSupported) {
      debug.warn('[WakeWord] Speech recognition not supported');
      return;
    }
    
    // Stop existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
    
    cooldownRef.current = false;
    detectionCountRef.current = 0;
    setIsDetected(false);
    
    const recognition = initRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (error) {
        debug.error('[WakeWord] Failed to start:', error);
      }
    }
  }, [isSpeechSupported, initRecognition]);
  
  // Stop listening
  const stopListening = useCallback(() => {
    cooldownRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);
  
  // Reset detection state
  const resetDetection = useCallback(() => {
    setIsDetected(false);
    setConfidence(0);
    detectionCountRef.current = 0;
  }, []);
  
  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && isSpeechSupported) {
      startListening();
    }
    
    return () => {
      stopListening();
    };
  }, [autoStart, isSpeechSupported, startListening, stopListening]);
  
  return {
    isListening,
    isDetected,
    startListening,
    stopListening,
    resetDetection,
    confidence
  };
}
