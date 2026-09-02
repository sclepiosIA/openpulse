import React from 'react';
import { Building2, User, Users, CheckSquare, Calendar, Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PulseWidgetMessagePreviewProps {
  content: string;
  maxLength?: number;
  className?: string;
}

// Entity type configuration for compact chips
const entityConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  etablissement: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    icon: <Building2 className="h-2.5 w-2.5" />,
  },
  contact: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: <User className="h-2.5 w-2.5" />,
  },
  groupe: {
    bg: 'bg-cyan-100',
    text: 'text-cyan-700',
    icon: <Users className="h-2.5 w-2.5" />,
  },
  tache: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: <CheckSquare className="h-2.5 w-2.5" />,
  },
  todo: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: <CheckSquare className="h-2.5 w-2.5" />,
  },
  evenement: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-700',
    icon: <Calendar className="h-2.5 w-2.5" />,
  },
  partenaire: {
    bg: 'bg-rose-100',
    text: 'text-rose-700',
    icon: <Handshake className="h-2.5 w-2.5" />,
  },
};

// Parse entity links and transform content
function parseContentWithEntities(content: string): React.ReactNode[] {
  // Regex to match #[Name](type:id) pattern
  const entityRegex = /#\[([^\]]+)\]\((\w+):([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = entityRegex.exec(content)) !== null) {
    const [fullMatch, name, type, id] = match;
    
    // Add text before this match
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      parts.push(
        <span key={`text-${keyIndex++}`}>
          {cleanMarkdown(textBefore)}
        </span>
      );
    }
    
    // Add entity chip
    const config = entityConfig[type];
    if (config) {
      // Truncate entity name if too long
      const displayName = name.length > 20 ? name.substring(0, 18) + '…' : name;
      parts.push(
        <span
          key={`entity-${keyIndex++}`}
          className={cn(
            "inline-flex items-center gap-0.5 px-1 py-0 rounded text-[10px] font-medium whitespace-nowrap",
            config.bg,
            config.text
          )}
        >
          {config.icon}
          <span className="truncate max-w-[100px]">{displayName}</span>
        </span>
      );
    } else {
      // Unknown entity type, just show name
      parts.push(<span key={`entity-${keyIndex++}`}>{name}</span>);
    }
    
    lastIndex = match.index + fullMatch.length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-${keyIndex++}`}>
        {cleanMarkdown(content.slice(lastIndex))}
      </span>
    );
  }
  
  return parts.length > 0 ? parts : [<span key="empty">{cleanMarkdown(content)}</span>];
}

// Clean basic markdown for display
function cleanMarkdown(text: string): string {
  return text
    // Remove bold markers but keep content
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove italic markers but keep content
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove inline code markers
    .replace(/`([^`]+)`/g, '$1')
    // Remove links but keep text [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

export function PulseWidgetMessagePreview({ 
  content, 
  maxLength = 60,
  className 
}: PulseWidgetMessagePreviewProps) {
  if (!content) return null;
  
  // Parse content with entity links
  const parsedParts = parseContentWithEntities(content);
  
  return (
    <span className={cn("inline", className)}>
      {parsedParts}
    </span>
  );
}

