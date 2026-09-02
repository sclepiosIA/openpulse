import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2 } from "lucide-react";

interface SharedDomainBadgeProps {
  etablissementNames: string[];
  groupeNom?: string | null;
}

export function SharedDomainBadge({ etablissementNames, groupeNom }: SharedDomainBadgeProps) {
  if (etablissementNames.length <= 1) return null;

  const badgeLabel = groupeNom 
    ? `${groupeNom} (${etablissementNames.length})`
    : `GHT (${etablissementNames.length})`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{badgeLabel}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            {groupeNom && <p className="font-semibold text-sm">{groupeNom}</p>}
            <p className="font-semibold">Établissements participants :</p>
            {etablissementNames.map((name, idx) => (
              <p key={idx} className="text-sm">• {name}</p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
