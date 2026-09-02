import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Stethoscope, Briefcase, FileText, Keyboard, Users } from "lucide-react";
import { ContactRoleQuickAssignDialog } from "./ContactRoleQuickAssignDialog";
import { cn } from "@/lib/utils";

interface ContactRoleBadgeProps {
  contact: {
    id: string;
    nom: string;
    prenom?: string;
    email?: string;
    type_contact: string | null;
  };
  onRoleAssigned?: (contactId: string, newRole: string) => void;
  size?: "sm" | "default" | "lg";
}

const ROLE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  "Cliniciens": {
    icon: Stethoscope,
    color: "bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300",
  },
  "Administration": {
    icon: Briefcase,
    color: "bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300",
  },
  "DIM": {
    icon: FileText,
    color: "bg-green-100 hover:bg-green-200 text-green-800 border-green-300",
  },
  "Informatique": {
    icon: Keyboard,
    color: "bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300",
  },
  "Secrétariat": {
    icon: Users,
    color: "bg-pink-100 hover:bg-pink-200 text-pink-800 border-pink-300",
  },
};

export function ContactRoleBadge({ contact, onRoleAssigned, size = "default" }: ContactRoleBadgeProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const isUnknown = !contact.type_contact || contact.type_contact === "Rôle inconnu";

  const handleRoleSelect = (role: string) => {
    onRoleAssigned?.(contact.id, role);
  };

  if (isUnknown) {
    return (
      <>
        <Badge
          variant="outline"
          className={cn(
            "gap-1 cursor-pointer transition-colors border",
            "bg-gray-50 hover:bg-gray-100 text-foreground border-gray-300",
            size === "sm" && "text-xs px-2 py-0.5",
            size === "lg" && "text-base px-3 py-1.5"
          )}
          onClick={() => setDialogOpen(true)}
        >
          <HelpCircle className={cn(
            size === "sm" && "h-3 w-3",
            size === "default" && "h-3.5 w-3.5",
            size === "lg" && "h-4 w-4"
          )} />
          Rôle inconnu
        </Badge>
        <ContactRoleQuickAssignDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSelect={handleRoleSelect}
          contactData={contact}
        />
      </>
    );
  }

  const config = contact.type_contact ? ROLE_CONFIG[contact.type_contact] : undefined;
  if (!config) {
    return (
      <Badge variant="outline" className={cn(
        size === "sm" && "text-xs px-2 py-0.5",
        size === "lg" && "text-base px-3 py-1.5"
      )}>
        {contact.type_contact || "Non défini"}
      </Badge>
    );
  }

  const Icon = config.icon;
  return (
    <Badge
      className={cn(
        "gap-1 border",
        config.color,
        size === "sm" && "text-xs px-2 py-0.5",
        size === "lg" && "text-base px-3 py-1.5"
      )}
    >
      <Icon className={cn(
        size === "sm" && "h-3 w-3",
        size === "default" && "h-3.5 w-3.5",
        size === "lg" && "h-4 w-4"
      )} />
      {contact.type_contact}
    </Badge>
  );
}
