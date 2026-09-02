import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileAppLayoutProps {
  children: ReactNode;
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  showBackButton?: boolean;
  backPath?: string;
  headerActions?: ReactNode;
  className?: string;
  hideHeader?: boolean;
  onBack?: () => void;
}

export function MobileAppLayout({ 
  children, 
  title, 
  icon: Icon, 
  iconColor = 'text-primary',
  showBackButton = false,
  backPath,
  headerActions,
  className,
  hideHeader = false,
  onBack
}: MobileAppLayoutProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn(
      "min-h-dvh flex flex-col bg-background",
      // Safe area padding for iOS PWA
      "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
      className
    )}>
      {/* Header minimaliste - masquable */}
      {!hideHeader && (
        <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          {showBackButton && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              className="flex-shrink-0 -ml-2" aria-label="Retour">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Icon className={cn("h-5 w-5 flex-shrink-0", iconColor)} />
          <h1 className="font-semibold text-lg truncate flex-1">{title}</h1>
          {headerActions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {headerActions}
            </div>
          )}
        </header>
      )}
      
      {/* Contenu principal - plein écran */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
