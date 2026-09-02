import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckSquare,
  Mail,
  User,
  Users,
  Handshake,
  ExternalLink,
  Video,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntityLink } from '@/hooks/pulse/usePulseAIChat';
import { AIEmailHoverCard } from '@/components/search/AIEmailHoverCard';
import { AIEstablishmentHoverCard } from '@/components/search/AIEstablishmentHoverCard';
import { AIContactHoverCard } from '@/components/search/AIContactHoverCard';
import { AITaskHoverCard } from '@/components/search/AITaskHoverCard';
import { AIEventHoverCard } from '@/components/search/AIEventHoverCard';

interface PulseMarkdownRendererProps {
  content: string;
  entityLinks?: EntityLink[];
  onEntityClick?: (entity: EntityLink) => void;
}

// Link type definitions with styles
type LinkType = 'email' | 'etablissement' | 'contact' | 'tache' | 'event' | 'visio' | 'groupe' | 'partenaire' | 'external' | 'other';

interface ParsedLink {
  type: LinkType;
  id: string | null;
  externalUrl?: string;
}

// Style configuration for each link type - compact for Pulse bubbles
const linkStyles: Record<LinkType, { bg: string; text: string; icon: React.ReactNode }> = {
  etablissement: {
    bg: 'bg-purple-500/15 hover:bg-purple-500/25 dark:bg-purple-500/20 dark:hover:bg-purple-500/30',
    text: 'text-purple-700 dark:text-purple-300',
    icon: <Building2 className="h-3 w-3 shrink-0" />,
  },
  email: {
    bg: 'bg-blue-500/15 hover:bg-blue-500/25 dark:bg-blue-500/20 dark:hover:bg-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    icon: <Mail className="h-3 w-3 shrink-0" />,
  },
  contact: {
    bg: 'bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-500/20 dark:hover:bg-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: <User className="h-3 w-3 shrink-0" />,
  },
  tache: {
    bg: 'bg-green-500/15 hover:bg-green-500/25 dark:bg-green-500/20 dark:hover:bg-green-500/30',
    text: 'text-green-700 dark:text-green-300',
    icon: <CheckSquare className="h-3 w-3 shrink-0" />,
  },
  event: {
    bg: 'bg-indigo-500/15 hover:bg-indigo-500/25 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30',
    text: 'text-indigo-700 dark:text-indigo-300',
    icon: <Calendar className="h-3 w-3 shrink-0" />,
  },
  groupe: {
    bg: 'bg-cyan-500/15 hover:bg-cyan-500/25 dark:bg-cyan-500/20 dark:hover:bg-cyan-500/30',
    text: 'text-cyan-700 dark:text-cyan-300',
    icon: <Users className="h-3 w-3 shrink-0" />,
  },
  partenaire: {
    bg: 'bg-rose-500/15 hover:bg-rose-500/25 dark:bg-rose-500/20 dark:hover:bg-rose-500/30',
    text: 'text-rose-700 dark:text-rose-300',
    icon: <Handshake className="h-3 w-3 shrink-0" />,
  },
  visio: {
    bg: 'bg-blue-500 hover:bg-blue-600',
    text: 'text-white font-medium',
    icon: <Video className="h-3 w-3 shrink-0" />,
  },
  external: {
    bg: '',
    text: 'text-primary hover:underline',
    icon: <ExternalLink className="h-3 w-3 opacity-60" />,
  },
  other: {
    bg: '',
    text: 'text-primary hover:underline',
    icon: null,
  },
};

// Check if link is a video conference link
function isVideoLink(href: string): boolean {
  return href.includes('meet.google.com') || 
         href.includes('zoom.us') || 
         href.includes('teams.microsoft.com') ||
         href.includes('whereby.com') ||
         href.includes('webex.com');
}

// Extract entity type and ID from internal links
function parseInternalLink(href: string): ParsedLink {
  // Email thread link: /emails?thread=UUID
  const emailMatch = href.match(/\/emails\?thread=([a-f0-9-]{36})/i);
  if (emailMatch) {
    return { type: 'email', id: emailMatch[1] };
  }
  
  // Establishment link: /etablissements/UUID
  const etablissementMatch = href.match(/\/etablissements\/([a-f0-9-]{36})/i);
  if (etablissementMatch) {
    return { type: 'etablissement', id: etablissementMatch[1] };
  }
  
  // Contact link: /contacts/UUID or /contacts?id=UUID
  const contactMatch = href.match(/\/contacts(?:\/|\?id=)([a-f0-9-]{36})/i);
  if (contactMatch) {
    return { type: 'contact', id: contactMatch[1] };
  }
  
  // Task link: /taches/UUID
  const tacheMatch = href.match(/\/taches\/([a-f0-9-]{36})/i);
  if (tacheMatch) {
    return { type: 'tache', id: tacheMatch[1] };
  }
  
  // Calendar event link: /calendrier?event=UUID
  const eventMatch = href.match(/\/calendrier\?event=([a-f0-9-]{36})/i);
  if (eventMatch) {
    return { type: 'event', id: eventMatch[1] };
  }

  // Groupe link: /groupes/UUID
  const groupeMatch = href.match(/\/groupes\/([a-f0-9-]{36})/i);
  if (groupeMatch) {
    return { type: 'groupe', id: groupeMatch[1] };
  }

  // Partenaire link: /partenaires/UUID
  const partenaireMatch = href.match(/\/partenaires\/([a-f0-9-]{36})/i);
  if (partenaireMatch) {
    return { type: 'partenaire', id: partenaireMatch[1] };
  }
  
  // Video conference external link
  if (isVideoLink(href)) {
    return { type: 'visio', id: null, externalUrl: href };
  }
  
  return { type: 'other', id: null };
}

export function PulseMarkdownRenderer({ content, entityLinks, onEntityClick }: PulseMarkdownRendererProps) {
  const navigate = useNavigate();

  // Clean UUIDs from content for display
  const cleanedContent = content
    .replace(/\s*\([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\)/gi, '')
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '')
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const handleClick = (href: string) => {
    if (href.startsWith('/')) {
      navigate(href);
    }
  };

  const renderLink = (href: string, children: React.ReactNode) => {
    const { type, id, externalUrl } = parseInternalLink(href);
    const style = linkStyles[type];

    // Video conference - external with special styling
    if (type === 'visio' && externalUrl) {
      return (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors text-xs",
            style.bg,
            style.text
          )}
        >
          {style.icon}
          <span>{children}</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-70" />
        </a>
      );
    }

    // Internal links with styled chips
    if (href.startsWith('/') && type !== 'other') {
      const linkButton = (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClick(href);
          }}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors text-xs",
            style.bg,
            style.text
          )}
          type="button"
        >
          {style.icon}
          <span>{children}</span>
        </button>
      );

      // Wrap with appropriate hover card
      if (type === 'email' && id) {
        return <AIEmailHoverCard threadId={id}>{linkButton}</AIEmailHoverCard>;
      }
      if (type === 'etablissement' && id) {
        return <AIEstablishmentHoverCard etablissementId={id}>{linkButton}</AIEstablishmentHoverCard>;
      }
      if (type === 'contact' && id) {
        return <AIContactHoverCard contactId={id}>{linkButton}</AIContactHoverCard>;
      }
      if (type === 'tache' && id) {
        return <AITaskHoverCard taskId={id}>{linkButton}</AITaskHoverCard>;
      }
      if (type === 'event' && id) {
        return <AIEventHoverCard eventId={id}>{linkButton}</AIEventHoverCard>;
      }

      return linkButton;
    }

    // Simple internal link without special styling
    if (href.startsWith('/')) {
      return (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClick(href);
          }}
          className="text-primary hover:underline font-medium cursor-pointer text-xs"
          type="button"
        >
          {children}
        </button>
      );
    }

    // External link
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline inline-flex items-center gap-0.5 text-xs"
      >
        <span>{children}</span>
        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
      </a>
    );
  };

  return (
    <div className="pulse-markdown text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings - compact for Pulse
          h1: ({ children }) => (
            <div className="text-sm font-bold text-foreground border-b border-border/50 pb-1.5 mb-3 mt-4 first:mt-0 flex items-center gap-1.5">
              <span className="w-1 h-4 bg-primary rounded-full shrink-0" />
              <span>{children}</span>
            </div>
          ),
          h2: ({ children }) => (
            <div className="text-sm font-semibold text-foreground mt-4 mb-2 first:mt-0 flex items-center gap-1.5">
              <span className="w-0.5 h-3.5 bg-primary/70 rounded-full shrink-0" />
              <span>{children}</span>
            </div>
          ),
          h3: ({ children }) => (
            <div className="text-xs font-semibold text-foreground mt-3 mb-1.5 first:mt-0">
              {children}
            </div>
          ),
          h4: ({ children }) => (
            <div className="text-xs font-medium text-muted-foreground mt-2 mb-1 first:mt-0">
              {children}
            </div>
          ),

          // Links with hover cards for internal entities
          a: ({ href, children }) => {
            if (!href) return <span>{children}</span>;
            return renderLink(href, children);
          },

          // Lists - compact
          ul: ({ children }) => (
            <ul className="list-none space-y-1 my-2 text-xs pl-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside space-y-1 my-2 text-xs pl-4">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-xs leading-relaxed flex items-start gap-1.5 pl-0">
              <span className="w-1 h-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
              <span className="flex-1 min-w-0">{children}</span>
            </li>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-xs leading-relaxed my-2 first:mt-0 last:mb-0">
              {children}
            </p>
          ),

          // Code - smaller
          code: ({ children, ...props }) => (
            <code className="bg-muted/70 px-1 py-0.5 rounded text-[10px] font-mono text-primary" {...props}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted/50 border border-border/30 p-2 rounded-lg overflow-x-auto my-2 text-[10px]">
              {children}
            </pre>
          ),

          // Tables - ChatGPT-style with zebra striping and clean design
          table: ({ children }) => (
            <div className="my-4">
              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-md">
                <table className="w-full text-sm border-collapse">
                  {children}
                </table>
              </div>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left font-semibold text-foreground text-xs uppercase tracking-wide border-b-2 border-border whitespace-nowrap first:rounded-tl-xl last:rounded-tr-xl">
              {children}
            </th>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/50">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-muted/30 hover:bg-primary/5 transition-colors">
              {children}
            </tr>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 align-middle text-sm text-foreground/90">
              <div className="min-w-0 break-words">
                {children}
              </div>
            </td>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/50 pl-2 my-2 text-muted-foreground italic text-xs bg-muted/20 py-1.5 rounded-r">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="my-3 border-border/50" />,

          // Text emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/80">{children}</em>
          ),
        }}
      >
        {cleanedContent}
      </ReactMarkdown>
    </div>
  );
}
