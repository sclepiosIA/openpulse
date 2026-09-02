import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { UserCog, Stethoscope, Briefcase, FileText, Keyboard, Users, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactRoleQuickAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (role: string) => void;
  contactData?: {
    nom: string;
    prenom?: string;
    email?: string;
  };
}

const ROLE_OPTIONS = [
  {
    value: "Cliniciens",
    label: "Cliniciens",
    icon: Stethoscope,
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
  {
    value: "Administration",
    label: "Administration",
    icon: Briefcase,
    color: "bg-purple-100 text-purple-800 border-purple-300",
  },
  {
    value: "DIM",
    label: "DIM",
    icon: FileText,
    color: "bg-green-100 text-green-800 border-green-300",
  },
  {
    value: "Informatique",
    label: "Informatique",
    icon: Keyboard,
    color: "bg-orange-100 text-orange-800 border-orange-300",
  },
  {
    value: "Secrétariat",
    label: "Secrétariat",
    icon: Users,
    color: "bg-pink-100 text-pink-800 border-pink-300",
  },
  {
    value: "Rôle inconnu",
    label: "Rôle inconnu",
    icon: HelpCircle,
    color: "bg-gray-100 text-foreground border-gray-300",
  },
];

export function ContactRoleQuickAssignDialog({
  open,
  onOpenChange,
  onSelect,
  contactData,
}: ContactRoleQuickAssignDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleSelect = (role: string) => {
    setSelectedRole(role);
    onSelect(role);
    onOpenChange(false);
    setTimeout(() => setSelectedRole(null), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Assigner un rôle au contact
          </DialogTitle>
          <DialogDescription>
            {contactData && (
              <span className="text-sm">
                Pour: {contactData.prenom} {contactData.nom}
                {contactData.email && ` (${contactData.email})`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {ROLE_OPTIONS.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.value}
                onClick={() => handleSelect(role.value)}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all",
                  "hover:scale-105 hover:shadow-md",
                  "flex flex-col items-center gap-2 text-center",
                  selectedRole === role.value && "ring-2 ring-primary",
                  role.color
                )}
              >
                <Icon className="h-8 w-8" />
                <span className="font-medium">{role.label}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
