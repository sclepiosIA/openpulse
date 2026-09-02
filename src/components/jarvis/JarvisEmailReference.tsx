/**
 * JarvisEmailReference - Lien email cliquable avec tooltip riche (v15.5)
 * 
 * Design "pill" moderne avec:
 * - Fond coloré semi-transparent
 * - Bordure subtile
 * - Animation scale au hover
 * - HoverCard informatif au survol
 */

import { Mail, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AIEmailHoverCard } from '@/components/search/AIEmailHoverCard';

interface JarvisEmailReferenceProps {
  threadId: string;
  title: string;
  className?: string;
}

export function JarvisEmailReference({ threadId, title, className }: JarvisEmailReferenceProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Close Jarvis panel before navigating
    window.dispatchEvent(new CustomEvent('jarvis:close'));
    navigate(`/emails?thread=${threadId}`);
  };

  return (
    <AIEmailHoverCard threadId={threadId}>
      <motion.button
        onClick={handleClick}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
          "bg-primary/10 hover:bg-primary/15",
          "border border-primary/20 hover:border-primary/30",
          "text-primary hover:text-primary",
          "transition-colors duration-200 cursor-pointer",
          "text-sm font-medium",
          "shadow-sm hover:shadow-md shadow-primary/5",
          className
        )}
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/15">
          <Mail className="h-3 w-3" />
        </div>
        <span className="truncate max-w-[250px]">{title}</span>
        <ArrowRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
      </motion.button>
    </AIEmailHoverCard>
  );
}
