import { Settings2, Inbox } from 'lucide-react';

export function NoSourceState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-1.5 text-muted-foreground">
      <Settings2 className="h-5 w-5" />
      <p className="text-xs">Configurer une source dans le panneau de droite</p>
    </div>
  );
}

export function NoDataState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-1.5 text-muted-foreground">
      <Inbox className="h-5 w-5" />
      <p className="text-xs">Aucune donnée pour cette période</p>
    </div>
  );
}
