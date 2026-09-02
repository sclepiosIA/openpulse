/**
 * JarvisThinkingIndicator - Premium animated thinking state (v12.7)
 * Design ultra premium avec wave animation, DNA helix, et texte contextuel
 */

import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Brain, Search, Database, Lightbulb, Cpu, Zap, Globe, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JarvisThinkingIndicatorProps {
  isStreaming?: boolean;
  streamingContent?: string;
  className?: string;
}

const thinkingPhrases = [
  { text: 'Analyse en cours', icon: Brain, color: 'text-purple-500' },
  { text: 'Recherche contextuelle', icon: Search, color: 'text-blue-500' },
  { text: 'Consultation base de données', icon: Database, color: 'text-emerald-500' },
  { text: 'Connexion aux sources', icon: Globe, color: 'text-cyan-500' },
  { text: 'Traitement IA', icon: Cpu, color: 'text-amber-500' },
  { text: 'Synthèse des informations', icon: FileText, color: 'text-rose-500' },
  { text: 'Préparation réponse', icon: Lightbulb, color: 'text-yellow-500' },
  { text: 'Optimisation', icon: Zap, color: 'text-primary' },
];

// DNA Helix Animation Component
const DNAHelix = memo(function DNAHelix() {
  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      {/* Central core */}
      <motion.div
        className="absolute w-2 h-2 rounded-full bg-gradient-to-br from-primary to-cyan-400"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      
      {/* Orbiting particles */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`jarvis-thinking-orbit-${i}`}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            background: i === 0 ? 'hsl(var(--primary))' : i === 1 ? 'rgb(34, 211, 238)' : 'rgb(168, 85, 247)',
          }}
          animate={{
            rotate: [i * 120, i * 120 + 360],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <motion.div
            className="w-full h-full rounded-full"
            style={{ 
              transform: 'translateX(14px)',
              boxShadow: '0 0 8px currentColor',
            }}
          />
        </motion.div>
      ))}
      
      {/* Pulsing ring */}
      <motion.div
        className="absolute inset-0 rounded-full border border-primary/30"
        animate={{
          scale: [1, 1.4, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
});

// Audio Wave Visualizer
const AudioWave = memo(function AudioWave() {
  return (
    <div className="flex items-center gap-0.5 h-6">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <motion.div
          key={`jarvis-thinking-audio-${i}`}
          className="w-1 rounded-full"
          style={{
            background: `linear-gradient(to top, hsl(var(--primary)), rgb(34, 211, 238))`,
          }}
          animate={{
            height: ['6px', `${12 + Math.sin(i * 0.8) * 10}px`, '6px'],
          }}
          transition={{
            duration: 0.6 + i * 0.05,
            repeat: Infinity,
            delay: i * 0.08,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
});

export const JarvisThinkingIndicator = memo(function JarvisThinkingIndicator({ 
  isStreaming, 
  streamingContent,
  className 
}: JarvisThinkingIndicatorProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Rotate through thinking phrases
  useEffect(() => {
    if (isStreaming && streamingContent) return;
    
    const phraseInterval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % thinkingPhrases.length);
    }, 2000);
    
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev + 1) % 100);
    }, 50);
    
    return () => {
      clearInterval(phraseInterval);
      clearInterval(progressInterval);
    };
  }, [isStreaming, streamingContent]);

  const currentPhrase = thinkingPhrases[phraseIndex];
  const PhraseIcon = currentPhrase.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={cn("flex gap-3", className)}
    >
      {/* Avatar with DNA helix animation */}
      <div className="relative flex-shrink-0">
        {/* Multi-layer glow */}
        <motion.div
          className="absolute -inset-2 rounded-3xl"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.3), transparent 70%)',
            filter: 'blur(12px)',
          }}
          animate={{
            opacity: [0.4, 0.7, 0.4],
            scale: [0.95, 1.1, 0.95],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        <motion.div 
          className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-cyan-500/15 ring-1 ring-primary/30 flex items-center justify-center shadow-2xl shadow-primary/20 backdrop-blur-xl overflow-hidden"
          animate={{
            boxShadow: [
              '0 8px 30px -5px hsl(var(--primary) / 0.25)',
              '0 8px 40px -5px hsl(var(--primary) / 0.4)',
              '0 8px 30px -5px hsl(var(--primary) / 0.25)',
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {/* Animated gradient background */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, transparent 0%, hsl(var(--primary) / 0.1) 50%, transparent 100%)',
            }}
            animate={{
              rotate: [0, 360],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
          
          <Bot className="h-5 w-5 text-primary relative z-10" />
          
          {/* Corner sparkle */}
          <motion.div
            className="absolute top-1 right-1"
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Sparkles className="h-2.5 w-2.5 text-cyan-400" />
          </motion.div>
        </motion.div>
      </div>

      {/* Content area - Ultra Premium glass card */}
      <div className="flex-1 bg-gradient-to-br from-card/95 via-card/90 to-muted/50 backdrop-blur-xl border border-border/40 rounded-2xl rounded-tl-md shadow-xl shadow-black/5 overflow-hidden">
        {isStreaming && streamingContent ? (
          // Show streaming content
          <div className="px-4 py-3">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {streamingContent}
                <motion.span
                  className="inline-block w-0.5 h-4 ml-1 bg-primary rounded-full"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              </p>
            </div>
          </div>
        ) : (
          // Premium thinking animation
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              {/* Animated contextual icon with glow */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={phraseIndex}
                  initial={{ scale: 0, rotate: -180, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, rotate: 180, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="relative"
                >
                  <motion.div
                    className={cn("absolute inset-0 rounded-xl blur-md", currentPhrase.color.replace('text-', 'bg-') + '/30')}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-muted/80 to-muted/40 ring-1 ring-border/50">
                    <PhraseIcon className={cn("h-4.5 w-4.5", currentPhrase.color)} />
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Animated text with typing effect */}
              <div className="flex-1 min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`text-${phraseIndex}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-sm font-medium text-foreground truncate">
                      {currentPhrase.text}
                    </span>
                    <motion.span
                      className="text-muted-foreground/60"
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      ...
                    </motion.span>
                  </motion.div>
                </AnimatePresence>
                
                {/* Subtle progress indicator */}
                <div className="mt-1.5 h-0.5 w-full rounded-full bg-muted/50 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-primary w-[30%]"
                    animate={{
                      x: ['-100%', '400%'],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                </div>
              </div>
              
              {/* Premium wave animation */}
              <AudioWave />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// Export additional components for flexibility
export { DNAHelix, AudioWave };
