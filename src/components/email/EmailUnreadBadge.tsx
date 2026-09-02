import { useContext } from 'react';
import { Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRealtimeEmailCompat } from '@/contexts/RealtimeEmailContext';
import { EmailFiltersContext } from '@/contexts/EmailFiltersContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { debug } from '@/lib/debug';

interface EmailUnreadBadgeProps {
  className?: string;
  variant?: 'default' | 'ghost-white';
}

export function EmailUnreadBadge({ className, variant = 'default' }: EmailUnreadBadgeProps) {
  // Use centralized realtime context instead of creating duplicate channels
  const { unreadCount, unreadByAccount, newEmails, getTopUnreadAccountId } = useRealtimeEmailCompat();
  const emailFiltersContext = useContext(EmailFiltersContext);
  const navigate = useNavigate();

  if (unreadCount === 0) return null;

  const handleClick = () => {
    debug.log('📧 Email badge clicked, triggering unread filter');
    
    // Navigate to the account with the most unread emails
    const topAccountId = getTopUnreadAccountId();
    if (topAccountId) {
      sessionStorage.setItem('selected_email_account', topAccountId);
    }
    
    emailFiltersContext?.triggerUnreadFilter();
    if (!emailFiltersContext) {
      sessionStorage.setItem('email_open_unread_only', 'true');
    }
    
    // Navigate to emails if not already there
    if (window.location.pathname !== '/emails') {
      navigate('/emails');
    } else {
      // Scroll to top if already on emails page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Get account breakdown for tooltip
  const accountBreakdown = Object.entries(unreadByAccount);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClick}
          className={cn("relative", className)} aria-label="E-mail">
            <Mail className={cn(
              "h-5 w-5",
              variant === 'ghost-white' ? "text-white" : "text-primary"
            )} />
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-in zoom-in pointer-events-none"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-xs">
              {unreadCount} email{unreadCount > 1 ? 's' : ''} non lu{unreadCount > 1 ? 's' : ''}
            </p>
            
            {/* Breakdown by account */}
            {accountBreakdown.length > 0 && (
              <div className="mt-2 space-y-1 border-t pt-2">
                {accountBreakdown.map(([accId, data]) => (
                  <p key={accId} className="text-xs flex justify-between gap-3">
                    <span className="truncate max-w-[150px] text-muted-foreground">{data.email}</span>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {data.count}
                    </Badge>
                  </p>
                ))}
              </div>
            )}
            
            {newEmails.length > 0 && (
              <div className="mt-2 space-y-1 border-t pt-2">
                <p className="text-xs text-muted-foreground">Nouveaux emails :</p>
                {newEmails.slice(0, 3).map((email) => (
                  <p key={email.id} className="text-xs truncate">
                    • {email.subject || 'Sans objet'}
                  </p>
                ))}
                {newEmails.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{newEmails.length - 3} autre{newEmails.length - 3 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
