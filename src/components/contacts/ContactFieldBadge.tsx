import { Badge } from "@/components/ui/badge"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Mail, Globe, Linkedin, User } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface ContactFieldBadgeProps {
  source: 'email' | 'fhf' | 'linkedin' | 'manual'
  updatedAt?: string | Date | null
  field?: string
}

const sourceConfig = {
  email: {
    label: "Email",
    icon: Mail,
    emoji: "📧",
    variant: "default" as const,
    description: "Enrichi depuis les emails"
  },
  fhf: {
    label: "FHF",
    icon: Globe,
    emoji: "🌐",
    variant: "secondary" as const,
    description: "Import depuis la base FHF"
  },
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    emoji: "💼",
    variant: "outline" as const,
    description: "Données LinkedIn"
  },
  manual: {
    label: "Manuel",
    icon: User,
    emoji: "👤",
    variant: "outline" as const,
    description: "Saisie manuelle"
  }
}

export function ContactFieldBadge({ source, updatedAt, field }: ContactFieldBadgeProps) {
  const config = sourceConfig[source]
  const Icon = config.icon

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <Badge 
          variant={config.variant} 
          className="cursor-help text-xs h-5 px-1.5 gap-1"
        >
          <Icon className="h-3 w-3" />
          <span className="hidden sm:inline">{config.label}</span>
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-64">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{config.emoji}</span>
            <div>
              <p className="text-sm font-semibold">{config.label}</p>
              <p className="text-xs text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>
          {field && (
            <p className="text-xs text-muted-foreground">
              Champ: <span className="font-medium">{field}</span>
            </p>
          )}
          {updatedAt && (
            <p className="text-xs text-muted-foreground">
              Mis à jour le{" "}
              <span className="font-medium">
                {format(new Date(updatedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </span>
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
