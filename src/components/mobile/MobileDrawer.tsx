import React, { useState } from 'react';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  snapPoints?: number[]; // Percentages for drawer height [50, 90, 100]
  className?: string;
}

/**
 * Composant intelligent qui affiche un Dialog sur desktop et un Drawer sur mobile
 * Le Drawer utilise des snap points pour un UX mobile optimale
 */
export function MobileDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  snapPoints = [50, 90],
  className,
}: MobileDrawerProps) {
  const isMobile = useIsMobile();
  const [activeSnapPoint, setActiveSnapPoint] = useState(snapPoints[0]);

  if (!isMobile) {
    // Desktop: Dialog classique
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('max-w-2xl', className)}>
          {title && (
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
          )}
          <div className="overflow-y-auto max-h-[70vh]">
            {children}
          </div>
          {footer && <div className="mt-4">{footer}</div>}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Drawer depuis le bas
  return (
    <Drawer 
      open={open} 
      onOpenChange={onOpenChange}
      dismissible
    >
      <DrawerContent 
        className={cn('max-h-[95vh]', className)}
        style={{ 
          height: `${activeSnapPoint}vh`,
        }}
      >
        {title && (
          <DrawerHeader className="text-left border-b pb-4">
            <DrawerTitle className="text-lg font-semibold">{title}</DrawerTitle>
            {description && (
              <DrawerDescription className="text-sm text-muted-foreground mt-1">
                {description}
              </DrawerDescription>
            )}
          </DrawerHeader>
        )}
        
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>

        {footer && (
          <DrawerFooter className="border-t pt-4 sticky bottom-0 bg-background">
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
