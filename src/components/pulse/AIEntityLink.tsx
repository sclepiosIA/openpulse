import { Link } from 'react-router-dom';
import { Building2, CheckSquare, Mail, User, Users, Handshake } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EntityLink } from '@/hooks/pulse/usePulseAIChat';

interface AIEntityLinkProps {
  entity: EntityLink;
  onClick?: (entity: EntityLink) => void;
  className?: string;
}

const ENTITY_CONFIG = {
  etablissement: {
    icon: Building2,
    color: 'text-purple-600 hover:text-purple-700',
    bgColor: 'bg-purple-500/10',
    label: 'Établissement',
    getUrl: (id: string) => `/etablissements/${id}`,
  },
  tache: {
    icon: CheckSquare,
    color: 'text-green-600 hover:text-green-700',
    bgColor: 'bg-green-500/10',
    label: 'Tâche',
    getUrl: (id: string) => `/etablissements?tache=${id}`,
  },
  email: {
    icon: Mail,
    color: 'text-blue-600 hover:text-blue-700',
    bgColor: 'bg-blue-500/10',
    label: 'Email',
    getUrl: (id: string) => `/emails?thread=${id}`,
  },
  contact: {
    icon: User,
    color: 'text-amber-600 hover:text-amber-700',
    bgColor: 'bg-amber-500/10',
    label: 'Contact',
    getUrl: (id: string) => `/contacts?id=${id}`,
  },
  groupe: {
    icon: Users,
    color: 'text-indigo-600 hover:text-indigo-700',
    bgColor: 'bg-indigo-500/10',
    label: 'Groupe',
    getUrl: (id: string) => `/groupes/${id}`,
  },
  partenaire: {
    icon: Handshake,
    color: 'text-rose-600 hover:text-rose-700',
    bgColor: 'bg-rose-500/10',
    label: 'Partenaire',
    getUrl: (id: string) => `/partenaires/${id}`,
  },
};

export function AIEntityLink({ entity, onClick, className }: AIEntityLinkProps) {
  const config = ENTITY_CONFIG[entity.type];

  if (!config) {
    return <span className={className}>{entity.name}</span>;
  }

  const Icon = config.icon;
  const url = config.getUrl(entity.id);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(entity);
    }
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link
          to={url}
          onClick={handleClick}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium underline-offset-2 hover:underline transition-colors",
            config.color,
            config.bgColor,
            className
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{entity.name}</span>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto p-3" side="top" align="start">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {config.label}
          </Badge>
          <span className="text-sm font-medium">{entity.name}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Cliquez pour voir les détails
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

// Helper: normalize text for matching (remove accents, lowercase)
function normalizeText(text: string): string {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

// Helper: find entity name in text with fuzzy matching
function findEntityInText(text: string, entityName: string): { start: number; end: number } | null {
  if (!entityName || entityName.length < 2) return null;
  
  const textLower = text.toLowerCase();
  const nameLower = entityName.toLowerCase();
  
  // Try exact match first
  const exactIdx = textLower.indexOf(nameLower);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + entityName.length };
  }
  
  // Try without accents
  const textNormalized = normalizeText(text);
  const nameNormalized = normalizeText(entityName);
  const normalizedIdx = textNormalized.indexOf(nameNormalized);
  if (normalizedIdx !== -1) {
    return { start: normalizedIdx, end: normalizedIdx + entityName.length };
  }
  
  return null;
}

// Component to render message content with entity links
interface MessageWithLinksProps {
  content: string;
  entityLinks?: EntityLink[];
  onEntityClick?: (entity: EntityLink) => void;
}

export function MessageWithLinks({ content, entityLinks, onEntityClick }: MessageWithLinksProps) {
  // Enhanced UUID cleaning (safety net)
  const cleanedContent = content
    // UUID entre parenthèses: (abc123-def...)
    .replace(/\s*\([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\)/gi, '')
    // UUID seul
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '')
    // Format id:nom résiduel
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:/gi, '')
    // Doubles espaces résiduels
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!entityLinks || entityLinks.length === 0) {
    return <span className="whitespace-pre-wrap break-words">{cleanedContent}</span>;
  }

  // Build parts array by replacing entity names with clickable links
  const parts: React.ReactNode[] = [];
  let keyIndex = 0;
  
  // Sort entities by name length (longest first) to avoid partial matches
  const sortedEntities = [...entityLinks].sort((a, b) => b.name.length - a.name.length);
  const usedRanges: { start: number; end: number }[] = [];

  // First pass: find all entity positions with fuzzy matching
  const entityPositions: { entity: EntityLink; start: number; end: number }[] = [];
  
  for (const entity of sortedEntities) {
    if (!entity.name || entity.name.length < 2) continue;
    
    let searchFrom = 0;
    const textLower = cleanedContent.toLowerCase();
    const nameLower = entity.name.toLowerCase();
    const textNormalized = normalizeText(cleanedContent);
    const nameNormalized = normalizeText(entity.name);
    
    while (searchFrom < cleanedContent.length) {
      // Try exact match
      let idx = textLower.indexOf(nameLower, searchFrom);
      
      // If no exact match, try normalized (without accents)
      if (idx === -1) {
        idx = textNormalized.indexOf(nameNormalized, searchFrom);
      }
      
      if (idx === -1) break;
      
      const end = idx + entity.name.length;
      
      // Check if this range overlaps with any used range
      const overlaps = usedRanges.some(r => 
        (idx >= r.start && idx < r.end) || (end > r.start && end <= r.end) ||
        (idx < r.start && end > r.end) // This range contains another
      );
      
      if (!overlaps) {
        entityPositions.push({ entity, start: idx, end });
        usedRanges.push({ start: idx, end });
      }
      
      searchFrom = idx + 1;
    }
  }

  // Sort positions by start index
  entityPositions.sort((a, b) => a.start - b.start);

  // Build parts from positions
  let lastEnd = 0;
  for (const pos of entityPositions) {
    // Add text before this entity
    if (pos.start > lastEnd) {
      parts.push(
        <span key={`text-${keyIndex++}`}>
          {cleanedContent.slice(lastEnd, pos.start)}
        </span>
      );
    }
    
    // Add the entity link (use original text from content for display)
    parts.push(
      <AIEntityLink
        key={`link-${pos.entity.type}-${pos.entity.id}-${keyIndex++}`}
        entity={{ ...pos.entity, name: cleanedContent.slice(pos.start, pos.end) }}
        onClick={onEntityClick}
        className="inline"
      />
    );
    
    lastEnd = pos.end;
  }

  // Add remaining text
  if (lastEnd < cleanedContent.length) {
    parts.push(
      <span key={`text-${keyIndex++}`}>
        {cleanedContent.slice(lastEnd)}
      </span>
    );
  }

  // If no entities were found in text, show cleaned content with links as a fallback section
  if (parts.length === 0) {
    return (
      <div>
        <span className="whitespace-pre-wrap break-words">{cleanedContent}</span>
        <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-border/50">
          {entityLinks.map((entity, index) => (
            <AIEntityLink
              key={`${entity.type}-${entity.id}-${index}`}
              entity={entity}
              onClick={onEntityClick}
            />
          ))}
        </div>
      </div>
    );
  }

  return <span className="whitespace-pre-wrap break-words">{parts}</span>;
}
