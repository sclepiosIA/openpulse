import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

export function CanvasLegend() {
  const [open, setOpen] = useState(true);

  return (
    <div className="absolute top-3 left-3 z-10 bg-card/95 backdrop-blur border rounded-lg shadow-sm text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 w-full hover:bg-muted/50 rounded-t-lg"
      >
        <Info className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">Légende</span>
        {open ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </button>
      {open && (
        <div className="px-3 pb-2.5 space-y-1.5 border-t">
          <LegendRow color="bg-emerald-500" label="Succès" />
          <LegendRow color="bg-destructive" label="Échec" pulse />
          <LegendRow color="bg-blue-500" label="Simulé (test)" dashed />
          <LegendRow color="bg-amber-500" label="Avertissement" />
          <LegendRow color="bg-muted-foreground/40" label="Non exécuté" />
        </div>
      )}
    </div>
  );
}

function LegendRow({ color, label, pulse, dashed }: { color: string; label: string; pulse?: boolean; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-3 w-3 rounded-full ${color} ${pulse ? 'animate-pulse' : ''} ${
          dashed ? 'ring-2 ring-dashed' : ''
        }`}
      />
      <span className="text-foreground">{label}</span>
    </div>
  );
}
