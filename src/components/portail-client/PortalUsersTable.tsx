import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Power, PowerOff, Search } from "lucide-react";
import { ClientPortalUser, useToggleClientPortalUser } from "@/hooks/portail/useClientPortal";
import { ResetPortalPasswordDialog } from "./ResetPortalPasswordDialog";

interface Props {
  users: ClientPortalUser[];
  isLoading?: boolean;
  hideEtablissement?: boolean;
}

export function PortalUsersTable({ users, isLoading, hideEtablissement }: Props) {
  const [search, setSearch] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUserEmail, setResetUserEmail] = useState<string | undefined>();
  const toggle = useToggleClientPortalUser();

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const fullName = (u.full_name ?? `${u.prenom ?? ""} ${u.nom ?? ""}`).trim();
    return !q || u.email.toLowerCase().includes(q) || fullName.toLowerCase().includes(q) || (u.etablissement_nom ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              {!hideEtablissement && <TableHead>Établissement</TableHead>}
              <TableHead>Statut</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={hideEtablissement ? 5 : 6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={hideEtablissement ? 5 : 6} className="text-center py-8 text-muted-foreground">Aucun compte</TableCell></TableRow>
            ) : (
              filtered.map((u) => {
                const fullName = (u.full_name ?? `${u.prenom ?? ""} ${u.nom ?? ""}`).trim() || u.email;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    {!hideEtablissement && <TableCell>{u.etablissement_nom ?? "-"}</TableCell>}
                    <TableCell>
                      <Badge variant={u.actif ? "default" : "secondary"}>
                        {u.actif ? "Actif" : "Désactivé"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.last_login ? format(new Date(u.last_login), "dd/MM/yyyy HH:mm", { locale: fr }) : "Jamais"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setResetUserId(u.id); setResetUserEmail(u.email); }}
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-1" />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant={u.actif ? "outline" : "default"}
                        onClick={() => toggle.mutate({ userId: u.id, active: !u.actif })}
                        disabled={toggle.isPending}
                      >
                        {u.actif ? <PowerOff className="h-3.5 w-3.5 mr-1" /> : <Power className="h-3.5 w-3.5 mr-1" />}
                        {u.actif ? "Désactiver" : "Activer"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ResetPortalPasswordDialog
        open={!!resetUserId}
        onOpenChange={(o) => { if (!o) { setResetUserId(null); setResetUserEmail(undefined); } }}
        userId={resetUserId}
        userEmail={resetUserEmail}
      />
    </div>
  );
}
