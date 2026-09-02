import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { Video, ExternalLink, Mail, Building2, User, CheckSquare, Calendar } from 'lucide-react';
import { AIEmailHoverCard } from './AIEmailHoverCard';
import { AIEstablishmentHoverCard } from './AIEstablishmentHoverCard';
import { AIContactHoverCard } from './AIContactHoverCard';
import { AITaskHoverCard } from './AITaskHoverCard';
import { AIEventHoverCard } from './AIEventHoverCard';
import { cn } from '@/lib/utils';

interface AIMarkdownRendererProps {
  content: string;
  onLinkClick?: () => void;
}

// Link type definitions with styles
type LinkType = 'email' | 'etablissement' | 'contact' | 'tache' | 'event' | 'visio' | 'external' | 'other';

interface ParsedLink {
  type: LinkType;
  id: string | null;
  externalUrl?: string;
}

// Style configuration for each link type
const linkStyles: Record<LinkType, { bg: string; text: string; icon: React.ReactNode }> = {
  etablissement: {
    bg: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50',
    text: 'text-blue-700 dark:text-blue-400',
    icon: <Building2 className="h-3 w-3 shrink-0" />,
  },
  email: {
    bg: 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50',
    text: 'text-indigo-700 dark:text-indigo-400',
    icon: <Mail className="h-3 w-3 shrink-0" />,
  },
  contact: {
    bg: 'bg-green-50 hover:bg-green-100 dark:bg-green-950/50 dark:hover:bg-green-900/50',
    text: 'text-green-700 dark:text-green-400',
    icon: <User className="h-3 w-3 shrink-0" />,
  },
  tache: {
    bg: 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/50 dark:hover:bg-orange-900/50',
    text: 'text-orange-700 dark:text-orange-400',
    icon: <CheckSquare className="h-3 w-3 shrink-0" />,
  },
  event: {
    bg: 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50',
    text: 'text-purple-700 dark:text-purple-400',
    icon: <Calendar className="h-3 w-3 shrink-0" />,
  },
  visio: {
    bg: 'bg-blue-500 hover:bg-blue-600',
    text: 'text-white font-semibold',
    icon: <Video className="h-3.5 w-3.5 shrink-0" />,
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

// UUID regex pattern
const UUID_PATTERN = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

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
  
  // Contact link: /contacts/UUID
  const contactMatch = href.match(/\/contacts\/([a-f0-9-]{36})/i);
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
  
  // Video conference external link
  if (isVideoLink(href)) {
    return { type: 'visio', id: null, externalUrl: href };
  }
  
  return { type: 'other', id: null };
}

export function AIMarkdownRenderer({ content, onLinkClick }: AIMarkdownRendererProps) {
  const navigate = useNavigate();

  const handleClick = (href: string) => {
    if (href.startsWith('/')) {
      onLinkClick?.();
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
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs",
            style.bg,
            style.text
          )}
        >
          {style.icon}
          <span>{children}</span>
          <ExternalLink className="h-3 w-3 opacity-70" />
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
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium cursor-pointer transition-colors text-xs",
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
          className="text-primary hover:underline font-medium cursor-pointer"
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
        className="text-primary hover:underline inline-flex items-center gap-1"
      >
        <span>{children}</span>
        <ExternalLink className="h-3 w-3 opacity-60" />
      </a>
    );
  };

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h2 className="text-base font-bold text-foreground border-b border-border pb-2 mb-4 mt-5 first:mt-0 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full shrink-0" />
              <span>{children}</span>
            </h2>
          ),
          h2: ({ children }) => (
            <h3 className="text-sm font-semibold text-foreground mt-5 mb-3 first:mt-0 flex items-center gap-2 border-b border-border/50 pb-2">
              <span className="w-1 h-5 bg-primary/70 rounded-full shrink-0" />
              <span>{children}</span>
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-sm font-medium text-foreground mt-4 mb-2 first:mt-0">
              {children}
            </h4>
          ),

          // Links with hover cards for internal entities
          a: ({ href, children }) => {
            if (!href) return <span>{children}</span>;
            return renderLink(href, children);
          },

          // Lists
          ul: ({ children }) => (
            <ul className="list-none space-y-2 my-3 text-sm pl-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside space-y-2 my-3 text-sm pl-5">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed flex items-start gap-2 pl-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-2 shrink-0" />
              <span className="flex-1 min-w-0">{children}</span>
            </li>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-sm leading-relaxed my-3 first:mt-0 last:mb-0 text-foreground/90">
              {children}
            </p>
          ),

          // Code
          code: ({ children, ...props }) => (
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary" {...props}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted/80 border border-border/50 p-3 rounded-lg overflow-x-auto my-3 text-xs">
              {children}
            </pre>
          ),

          // Tables - responsive display
          table: ({ children }) => (
            <div className="my-4 -mx-2 sm:mx-0">
              <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  {children}
                </table>
              </div>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/80 border-b border-border">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-2 sm:px-3 py-2 text-left font-semibold text-foreground text-xs whitespace-nowrap">
              {children}
            </th>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/50">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/30 transition-colors">
              {children}
            </tr>
          ),
          td: ({ children }) => (
            <td className="px-2 sm:px-3 py-2 align-top text-xs">
              <div className="max-w-[200px] sm:max-w-none break-words">
                {children}
              </div>
            </td>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-3 my-3 text-muted-foreground italic text-sm bg-muted/30 py-2 rounded-r-lg">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="my-4 border-border" />,

          // Text emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/80">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
