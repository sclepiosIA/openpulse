import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Keyboard, UserPlus } from "lucide-react";
import { UniversalSearchBar } from "@/components/shared/UniversalSearchBar";
import { KeyboardShortcutsHelp } from "@/components/shared/KeyboardShortcutsHelp";
import { useRolePermissions } from "@/hooks/auth/useRolePermissions";
import { AddUserDialog } from "./AddUserDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PeopleHeaderProps {
  title: string;
  subtitle?: string;
  context: 'rh' | 'equipe';
  showSetupTeamButton?: boolean;
  onSetupTeam?: () => void;
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;
}

export function PeopleHeader({
  title,
  subtitle,
  context,
  showSetupTeamButton = false,
  onSetupTeam,
  showShortcuts,
  setShowShortcuts,
}: PeopleHeaderProps) {
  const permissions = useRolePermissions();
  const [showAddUser, setShowAddUser] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
            {!permissions.isAdmin && permissions.role && (
              <Badge variant="outline" className="text-xs">
                {permissions.role === 'chef_projet' ? 'Chef de Projet' : 
                 permissions.role === 'csm' ? 'CSM' : 
                 permissions.role === 'commercial' ? 'Commercial' : permissions.role}
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <UniversalSearchBar />
          {permissions.isAdmin && (
            <Button onClick={() => setShowAddUser(true)} variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Ajouter un utilisateur
            </Button>
          )}
          {showSetupTeamButton && onSetupTeam && (
            <Button onClick={onSetupTeam} variant="outline">
              Configurer l'équipe
            </Button>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowShortcuts(true)}
                  aria-label="Raccourcis clavier"
                  title="Raccourcis clavier"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Raccourcis clavier (Ctrl+?)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <KeyboardShortcutsHelp 
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
        context={context}
      />

      <AddUserDialog 
        open={showAddUser}
        onOpenChange={setShowAddUser}
      />
    </>
  );
}
