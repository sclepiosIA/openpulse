import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Users, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmailAvatar } from "./EmailAvatar";

interface CCAddress {
  email: string;
  name?: string | null;
}

interface CollapsibleCCBannerProps {
  ccAddresses: CCAddress[] | string[] | string | null;
  bccAddresses?: CCAddress[] | string[] | string | null;
  className?: string;
}

/**
 * Parse addresses to CCAddress format
 */
function parseAddresses(addresses: CCAddress[] | string[] | string | null): CCAddress[] {
  if (!addresses) return [];
  
  if (typeof addresses === 'string') {
    // Parse comma-separated string
    return addresses.split(',').map(addr => {
      const trimmed = addr.trim();
      const match = trimmed.match(/^(.+?)\s*<(.+?)>$/);
      if (match) {
        return { name: match[1].trim(), email: match[2].trim() };
      }
      return { email: trimmed };
    }).filter(a => a.email);
  }
  
  if (Array.isArray(addresses)) {
    return addresses.map(addr => {
      if (typeof addr === 'string') {
        const match = addr.match(/^(.+?)\s*<(.+?)>$/);
        if (match) {
          return { name: match[1].trim(), email: match[2].trim() };
        }
        return { email: addr };
      }
      return {
        email: addr.email || '',
        name: addr.name || null
      };
    }).filter(a => a.email);
  }
  
  return [];
}

/**
 * Get display name from CCAddress
 */
function getDisplayName(addr: CCAddress): string {
  if (addr.name) return addr.name;
  return addr.email.split('@')[0];
}

/**
 * Bandeau CC/BCC collapsible avec badges cliquables
 */
export function CollapsibleCCBanner({ 
  ccAddresses, 
  bccAddresses,
  className 
}: CollapsibleCCBannerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const ccList = parseAddresses(ccAddresses);
  const bccList = parseAddresses(bccAddresses ?? null);
  const totalCount = ccList.length + bccList.length;

  if (totalCount === 0) return null;

  const handleCopyEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    toast.success("Adresse copiée !", {
      description: email,
      duration: 2000
    });
  };

  const handleCopyAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allEmails = [...ccList, ...bccList].map(a => a.email).join(', ');
    navigator.clipboard.writeText(allEmails);
    toast.success(`${totalCount} adresse${totalCount > 1 ? 's' : ''} copiée${totalCount > 1 ? 's' : ''} !`, {
      duration: 2000
    });
  };

  const renderAddressBadge = (addr: CCAddress, index: number, type: 'cc' | 'bcc') => (
    <Tooltip key={`${type}-${index}`}>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => handleCopyEmail(addr.email, e)}
          className={cn(
            "group inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
            "bg-muted/50 hover:bg-muted border border-border/50 hover:border-border",
            "transition-all duration-150 cursor-pointer"
          )}
        >
          <EmailAvatar
            name={addr.name}
            email={addr.email}
            size="sm"
            className="h-4 w-4 text-[8px]"
          />
          <span className="max-w-[150px] truncate text-foreground/80">
            {getDisplayName(addr)}
          </span>
          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">{addr.name || 'Contact'}</p>
        <p className="text-muted-foreground">{addr.email}</p>
        <p className="text-primary mt-1">Cliquer pour copier</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className={cn(
      "flex flex-col gap-2 text-xs border-l-2 border-muted-foreground/20 pl-3 py-1.5",
      className
    )}>
      {/* Header avec bouton toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Users className="h-3.5 w-3.5" />
          <span className="font-medium">
            {totalCount} en copie
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>

        {/* Actions rapides */}
        {isExpanded && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 gap-1 text-muted-foreground hover:text-foreground"
                onClick={handleCopyAll}
              >
                <Copy className="h-3 w-3" />
                <span>Tout copier</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copier toutes les adresses</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Liste des destinataires */}
      {isExpanded && (
        <div className="flex flex-col gap-2 pl-1">
          {/* CC */}
          {ccList.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground font-medium min-w-[28px]">CC</span>
              {ccList.map((addr, i) => renderAddressBadge(addr, i, 'cc'))}
            </div>
          )}
          
          {/* BCC */}
          {bccList.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground font-medium min-w-[28px]">CCI</span>
              {bccList.map((addr, i) => renderAddressBadge(addr, i, 'bcc'))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
