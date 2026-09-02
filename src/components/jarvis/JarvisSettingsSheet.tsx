/**
 * JarvisSettingsSheet - Wrapper Sheet pour JarvisSettingsContent
 * 
 * Conservé pour compatibilité si utilisé ailleurs dans l'application.
 * Le contenu principal est maintenant dans JarvisSettingsContent.
 */

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { JarvisSettingsContent } from './JarvisSettingsContent';

interface JarvisSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JarvisSettingsSheet({ open, onOpenChange }: JarvisSettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-hidden flex flex-col p-0 border-l-primary/10 z-[10000]">
        <JarvisSettingsContent />
      </SheetContent>
    </Sheet>
  );
}
