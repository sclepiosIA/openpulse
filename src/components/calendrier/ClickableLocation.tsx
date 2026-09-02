import { MapPin, Video, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { detectVisioLink } from '@/hooks/meeting/useVisioDetection';

interface ClickableLocationProps {
  location: string;
  className?: string;
  iconClassName?: string;
  showIcon?: boolean;
  truncate?: boolean;
}

/**
 * Renders a location that may contain a visio/meeting link as clickable.
 * Detects common visio patterns (Google Meet, Teams, Zoom, OpenPulse Meet).
 */
export function ClickableLocation({
  location,
  className,
  iconClassName = "h-3.5 w-3.5 flex-shrink-0",
  showIcon = true,
  truncate = true,
}: ClickableLocationProps) {
  // Check if location is a URL
  const isUrl = location.startsWith('http://') || location.startsWith('https://');
  
  // Check if it's a visio link
  const visioInfo = detectVisioLink(location);
  
  // Determine the icon to show
  const Icon = visioInfo ? Video : MapPin;
  
  if (isUrl || visioInfo) {
    const url = visioInfo?.url || location;
    const displayText = getDisplayText(location, visioInfo);
    
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex items-center gap-2 text-xs text-primary hover:underline cursor-pointer",
          className
        )}
      >
        {showIcon && <Icon className={cn(iconClassName, "text-primary")} />}
        <span className={cn(truncate && "truncate")}>{displayText}</span>
        <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
      </a>
    );
  }
  
  // Regular location - not clickable
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      {showIcon && <MapPin className={iconClassName} />}
      <span className={cn(truncate && "truncate")}>{location}</span>
    </div>
  );
}

/**
 * Get a user-friendly display text for the location
 */
function getDisplayText(location: string, visioInfo: ReturnType<typeof detectVisioLink>): string {
  if (visioInfo) {
    switch (visioInfo.provider) {
      case 'marque_meet':
        return 'OpenPulse Meet';
      case 'google_meet':
        return 'Google Meet';
      case 'teams':
        return 'Microsoft Teams';
      case 'zoom':
        return 'Zoom';
      default:
        return 'Visioconférence';
    }
  }
  
  // For generic URLs, try to extract domain
  try {
    const url = new URL(location);
    return url.hostname.replace('www.', '');
  } catch {
    return location;
  }
}
