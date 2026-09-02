/**
 * useJarvisVoice - Interface vocale bidirectionnelle pour Jarvis
 * 
 * Fonctionnalités:
 * - Speech-to-Text (STT) via Web Speech API
 * - Text-to-Speech (TTS) via Web Speech Synthesis
 * - Détection du wake word "Jarvis"
 * - Commandes vocales intelligentes
 * - Protection anti-spam avec debounce
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { JarvisVoiceCommand } from '@/types/jarvis';
import { debug } from '@/lib/debug';

// Minimal Web Speech API types (not in TS lib DOM by default for SpeechRecognition).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike> & { length: number };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
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

interface UseJarvisVoiceOptions {
  wakeWord?: string;
  language?: string;
  voiceSpeed?: number;
  onCommand?: (command: JarvisVoiceCommand) => void;
  onWakeUp?: () => void;
}

interface UseJarvisVoiceReturn {
  // Recognition (STT)
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  
  // Synthesis (TTS)
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  
  // Wake word
  isAwake: boolean;
  setIsAwake: (awake: boolean) => void;
  
  // Command
  lastCommand: JarvisVoiceCommand | null;
  
  // Config
  setWakeWord: (word: string) => void;
  setVoiceSpeed: (speed: number) => void;
}

// Pattern matching pour les commandes vocales
const COMMAND_PATTERNS: Array<{ pattern: RegExp; type: JarvisVoiceCommand['type']; extract?: (match: RegExpMatchArray) => Partial<JarvisVoiceCommand> }> = [
  { 
    pattern: /^(approuve|valide|ok|d'accord|confirme)/i, 
    type: 'approve' 
  },
  { 
    pattern: /^(rejette|ignore|annule|non|refuse)/i, 
    type: 'reject' 
  },
  { 
    pattern: /^(modifi|change|édite)/i, 
    type: 'modify' 
  },
  { 
    pattern: /^(lis|lecture|répète)\s*(l'action|les sources|tout)?/i, 
    type: 'read',
    extract: (match) => ({ 
      what: match[2]?.includes('source') ? 'sources' : 
            match[2]?.includes('tout') ? 'all' : 'action' 
    } as Partial<JarvisVoiceCommand>)
  },
  { 
    pattern: /^(liste|montre|affiche)\s*(les actions|mes actions)?/i, 
    type: 'list' 
  },
  { 
    pattern: /^(aide|help|comment)/i, 
    type: 'help' 
  },
  { 
    pattern: /^(.+)$/i, 
    type: 'ask',
    extract: (match) => ({ query: match[1] } as Partial<JarvisVoiceCommand>)
  },
];

// Debounce delay for commands (ms)
const COMMAND_DEBOUNCE_MS = 500;

export function useJarvisVoice({
  wakeWord: initialWakeWord = 'Jarvis',
  language = 'fr-FR',
  voiceSpeed: initialVoiceSpeed = 1.0,
  onCommand,
  onWakeUp,
}: UseJarvisVoiceOptions = {}): UseJarvisVoiceReturn {
  
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState<JarvisVoiceCommand | null>(null);
  const [wakeWord, setWakeWord] = useState(initialWakeWord);
  const [voiceSpeed, setVoiceSpeed] = useState(initialVoiceSpeed);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ANTI-SPAM: Refs to avoid circular dependencies and enable debouncing
  const isAwakeRef = useRef(isAwake);
  const onCommandRef = useRef(onCommand);
  const onWakeUpRef = useRef(onWakeUp);
  const lastCommandTimeRef = useRef(0);
  const isProcessingRef = useRef(false);
  const isListeningRef = useRef(false);

  // Sync refs with state
  useEffect(() => { isAwakeRef.current = isAwake; }, [isAwake]);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { onWakeUpRef.current = onWakeUp; }, [onWakeUp]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  // Vérifier la disponibilité de Web Speech API
  const isSpeechSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  
  const isSynthesisSupported = typeof window !== 'undefined' && 
    'speechSynthesis' in window;

  // Parser une commande vocale
  const parseCommand = useCallback((text: string): JarvisVoiceCommand | null => {
    const trimmedText = text.trim().toLowerCase();
    
    for (const { pattern, type, extract } of COMMAND_PATTERNS) {
      const match = trimmedText.match(pattern);
      if (match) {
        const baseCommand = { type } as JarvisVoiceCommand;
        if (extract) {
          return { ...baseCommand, ...extract(match) } as JarvisVoiceCommand;
        }
        return baseCommand;
      }
    }
    
    return null;
  }, []);

  // Détecter le wake word
  const checkWakeWord = useCallback((text: string): boolean => {
    const lowerText = text.toLowerCase();
    const lowerWakeWord = wakeWord.toLowerCase();
    
    return lowerText.includes(lowerWakeWord) || 
           lowerText.startsWith('hey ' + lowerWakeWord) ||
           lowerText.startsWith('ok ' + lowerWakeWord);
  }, [wakeWord]);

  // Extraire la commande après le wake word
  const extractCommandAfterWakeWord = useCallback((text: string): string => {
    const lowerWakeWord = wakeWord.toLowerCase();
    
    // Patterns de wake word
    const patterns = [
      new RegExp(`hey\\s+${lowerWakeWord}[,\\s]*`, 'i'),
      new RegExp(`ok\\s+${lowerWakeWord}[,\\s]*`, 'i'),
      new RegExp(`${lowerWakeWord}[,\\s]*`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return text.slice(match.index! + match[0].length).trim();
      }
    }
    
    return text;
  }, [wakeWord]);

  // Initialiser la reconnaissance vocale - NO circular dependencies
  const initRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (!isSpeechSupported) return null;

    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return null;

    const recognition: SpeechRecognitionLike = new SpeechRecognitionAPI();
    // STABILITY FIX: Use non-continuous mode with manual restart
    recognition.continuous = false;
    recognition.interimResults = false; // Only final results to reduce spam
    recognition.lang = language;

    recognition.onstart = () => {
      debug.log('[JarvisVoice] Recognition started');
      setIsListening(true);
      isListeningRef.current = true;
    };

    recognition.onend = () => {
      debug.log('[JarvisVoice] Recognition ended');
      setIsListening(false);
      isListeningRef.current = false;
      
      // STABILITY FIX: Auto-restart if still supposed to be listening
      if (isListeningRef.current && recognitionRef.current) {
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              debug.warn('[JarvisVoice] Auto-restart failed:', e);
            }
          }
        }, 100);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      debug.warn('[JarvisVoice] Recognition error:', event.error);
      
      // Only stop on fatal errors, not on no-speech
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setIsListening(false);
        isListeningRef.current = false;
      }
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {

      // ANTI-SPAM: Debounce check
      const now = Date.now();
      if (now - lastCommandTimeRef.current < COMMAND_DEBOUNCE_MS) {
        debug.log('[JarvisVoice] Debounced - ignoring result');
        return;
      }
      
      // ANTI-SPAM: Prevent concurrent processing
      if (isProcessingRef.current) {
        debug.log('[JarvisVoice] Already processing - ignoring result');
        return;
      }
      
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
      
      if (finalTranscript) {
        isProcessingRef.current = true;
        lastCommandTimeRef.current = now;
        
        setTranscript(finalTranscript);
        
        // Vérifier le wake word - USE REFS to avoid stale closures
        if (checkWakeWord(finalTranscript)) {
          const commandText = extractCommandAfterWakeWord(finalTranscript);
          setIsAwake(true);
          isAwakeRef.current = true;
          onWakeUpRef.current?.();
          
          // Reset du wake state après 30 secondes d'inactivité
          if (wakeWordTimeoutRef.current) {
            clearTimeout(wakeWordTimeoutRef.current);
          }
          wakeWordTimeoutRef.current = setTimeout(() => {
            setIsAwake(false);
            isAwakeRef.current = false;
          }, 30000);
          
          // Parser la commande si présente
          if (commandText) {
            const command = parseCommand(commandText);
            if (command) {
              setLastCommand(command);
              onCommandRef.current?.(command);
            }
          }
        } else if (isAwakeRef.current) {
          // Si déjà awake, traiter comme commande directe
          const command = parseCommand(finalTranscript);
          if (command) {
            setLastCommand(command);
            onCommandRef.current?.(command);
          }
        }
        
        // Release processing lock after a short delay
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 100);
      }
    };

    return recognition;
  // STABILITY FIX: Remove isAwake, onCommand, onWakeUp from dependencies - use refs instead
  }, [isSpeechSupported, language, checkWakeWord, extractCommandAfterWakeWord, parseCommand]);

  // Démarrer l'écoute
  const startListening = useCallback(() => {
    if (!isSpeechSupported) {
      debug.warn('[JarvisVoice] Speech recognition not supported');
      return;
    }

    // Stop existing recognition first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }

    const recognition = initRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      isListeningRef.current = true;
      try {
        recognition.start();

      } catch (error) {
        debug.error('[JarvisVoice] Failed to start recognition:', error);
        isListeningRef.current = false;
      }
    }
  }, [isSpeechSupported, initRecognition]);

  // Arrêter l'écoute
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Synthèse vocale (TTS)
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!isSynthesisSupported) {
      debug.warn('[JarvisVoice] Speech synthesis not supported');
      return;
    }

    // Arrêter toute synthèse en cours
    window.speechSynthesis.cancel();

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = voiceSpeed;
      utterance.pitch = 1.0;
      
      // Chercher une voix française de qualité
      const voices = window.speechSynthesis.getVoices();
      const frenchVoice = voices.find(v => 
        v.lang.startsWith('fr') && (v.name.includes('Google') || v.name.includes('Microsoft'))
      ) || voices.find(v => v.lang.startsWith('fr'));
      
      if (frenchVoice) {
        utterance.voice = frenchVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };

      utterance.onerror = (event) => {
        debug.error('[JarvisVoice] TTS error:', event);
        setIsSpeaking(false);
        resolve();
      };

      synthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, [isSynthesisSupported, language, voiceSpeed]);

  // Arrêter la synthèse
  const stopSpeaking = useCallback(() => {
    if (isSynthesisSupported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [isSynthesisSupported]);

  // Cleanup
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      if (isSynthesisSupported) {
        window.speechSynthesis.cancel();
      }
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
      }
    };
  }, [isSynthesisSupported]);

  // Charger les voix au montage
  useEffect(() => {
    if (isSynthesisSupported) {
      // Les voix peuvent être chargées de manière asynchrone
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, [isSynthesisSupported]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSpeaking,
    speak,
    stopSpeaking,
    isAwake,
    setIsAwake,
    lastCommand,
    setWakeWord,
    setVoiceSpeed,
  };
}
