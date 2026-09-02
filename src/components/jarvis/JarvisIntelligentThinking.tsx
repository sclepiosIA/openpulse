/**
 * JarvisIntelligentThinking - Indicateur de réflexion premium (v14.0)
 * 
 * Features:
 * - Multiple animation variants (dots, wave, brain, dna)
 * - Contextual status messages
 * - Tool execution progress
 * - Glassmorphism design
 */

import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sparkles,
  Search,
  Database,
  Mail,
  FileText,
  Zap,
  BarChart2,
  Settings,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import jarvisLogo from '@/assets/jarvis-logo.png';

// Status messages that rotate
const THINKING_MESSAGES = [
  { text: 'Analyse en cours...', icon: Brain },
  { text: 'Réflexion...', icon: Sparkles },
  { text: 'Recherche de données...', icon: Search },
  { text: 'Traitement...', icon: Settings },
  { text: 'Génération de la réponse...', icon: Zap },
];

interface JarvisIntelligentThinkingProps {
  variant?: 'dots' | 'wave' | 'brain' | 'minimal';
  currentTool?: string;
  className?: string;
}

export const JarvisIntelligentThinking = memo(function JarvisIntelligentThinking({
  variant = 'dots',
  currentTool,
  className,
}: JarvisIntelligentThinkingProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate messages every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const currentMessage = THINKING_MESSAGES[messageIndex];
  const MessageIcon = currentMessage.icon;

  // Tool icon mapping
  const getToolIcon = (tool: string) => {
    const icons: Record<string, React.ElementType> = {
      'get_emails': Mail,
      'search_database': Database,
      'analyze_data': BarChart2,
      'generate_report': FileText,
    };
    return icons[tool] || Zap;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
      className={cn("flex gap-3", className)}
    >
      {/* Avatar with animation */}
      <motion.div className="flex-shrink-0 self-end">
        <div className="relative">
          {/* Pulsing glow */}
          <motion.div
            className="absolute -inset-2 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 blur-lg"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          
          {/* Avatar */}
          <motion.div
            className={cn(
              "relative w-8 h-8 rounded-full",
              "bg-gradient-to-br from-primary to-primary/80",
              "flex items-center justify-center",
              "shadow-lg shadow-primary/30",
              "ring-2 ring-background"
            )}
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <img loading="lazy" decoding="async" src={jarvisLogo} 
              alt="Jarvis" 
              className="w-5 h-5 object-contain" />
          </motion.div>
        </div>
      </motion.div>

      {/* Thinking indicator */}
      <div className="flex flex-col gap-2">
        {/* Main bubble */}
        <motion.div
          className={cn(
            "px-4 py-3 rounded-2xl rounded-bl-md",
            "bg-muted/50 backdrop-blur-sm",
            "border border-border/40",
            "shadow-sm"
          )}
          layout
        >
          {/* Dots variant */}
          {variant === 'dots' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={`think-dot-${i}`}
                    className="w-2 h-2 rounded-full bg-primary"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Wave variant */}
          {variant === 'wave' && (
            <div className="flex items-center gap-1 h-5">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={`think-wave-${i}`}
                  className="w-1 bg-primary rounded-full"
                  animate={{
                    height: ['8px', '20px', '8px'],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          )}

          {/* Brain variant */}
          {variant === 'brain' && (
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Brain className="w-5 h-5 text-primary" />
              </motion.div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={messageIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-2"
                >
                  <MessageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {currentMessage.text}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Minimal variant */}
          {variant === 'minimal' && (
            <motion.span
              className="text-sm text-muted-foreground"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Jarvis réfléchit...
            </motion.span>
          )}
        </motion.div>

        {/* Tool execution indicator */}
        <AnimatePresence>
          {currentTool && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl",
                "bg-primary/5 border border-primary/20",
                "text-xs text-muted-foreground"
              )}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="w-3 h-3 text-primary" />
                </motion.div>
                <span>Exécution: </span>
                <span className="font-medium text-primary">
                  {currentTool}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

// DNA Helix animation component for advanced thinking visualization
export const JarvisDNAThinking = memo(function JarvisDNAThinking({
  className,
}: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("flex items-center justify-center py-4", className)}
    >
      <div className="relative w-12 h-12">
        {/* Orbiting particles */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={`dna-particle-${i}`}
            className="absolute w-2 h-2 rounded-full bg-primary"
            style={{
              top: '50%',
              left: '50%',
              marginTop: '-4px',
              marginLeft: '-4px',
            }}
            animate={{
              x: [
                Math.cos((i * 2 * Math.PI) / 3) * 20,
                Math.cos((i * 2 * Math.PI) / 3 + Math.PI) * 20,
                Math.cos((i * 2 * Math.PI) / 3) * 20,
              ],
              y: [
                Math.sin((i * 2 * Math.PI) / 3) * 20,
                Math.sin((i * 2 * Math.PI) / 3 + Math.PI) * 20,
                Math.sin((i * 2 * Math.PI) / 3) * 20,
              ],
              scale: [1, 0.8, 1],
              opacity: [1, 0.5, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
        
        {/* Center core */}
        <motion.div
          className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/30"
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </div>
    </motion.div>
  );
});
