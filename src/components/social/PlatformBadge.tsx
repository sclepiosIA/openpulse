import { Facebook, Instagram, Linkedin, Music2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS, type SocialPlatform } from '@/types/social';

const ICONS = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  tiktok: Music2,
} as const;

interface Props {
  platform: SocialPlatform;
  variant?: 'default' | 'outline' | 'secondary';
  showLabel?: boolean;
  className?: string;
}

export function PlatformBadge({ platform, variant = 'secondary', showLabel = true, className }: Props) {
  const Icon = ICONS[platform];
  return (
    <Badge variant={variant} className={cn('gap-1.5', className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {showLabel && <span>{PLATFORM_LABELS[platform]}</span>}
    </Badge>
  );
}
