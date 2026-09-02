import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Check, KeyRound, ChevronsUpDown } from "lucide-react";
import { useCreateClientPortalUser } from "@/hooks/portail/useClientPortal";
import { useEtablissements } from "@/hooks/crm/useEtablissements";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  etablissementId?: string;
}

export function CreatePortalUserDialog({ open, onOpenChange, etablissementId }: Props) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [etabId, setEtabId] = useState(etablissementId ?? "");
  const [etabSearchOpen, setEtabSearchOpen] = useState(false);
  const [etabSearch, setEtabSearch] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: etablissements } = useEtablissements();
  const create = useCreateClientPortalUser();

  const selectedEtab = etablissements?.find((e: any) => e.id === etabId);
  const filteredEtabs = (etablissements || []).filter((e: any) => {
    if (!etabSearch) return true;
    const q = etabSearch.toLowerCase();
    return (
      e.nom?.toLowerCase().includes(q) ||
      e.ville?.toLowerCase().includes(q) ||
      e.region?.toLowerCase().includes(q) ||
      e.code_postal?.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await create.mutateAsync({
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      etablissement_id: etabId,
    });
    setTempPassword(res.temp_password);
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setEmail("");
      setFullName("");
      setEtabId(etablissementId ?? "");
      setTempPassword(null);
      setCopied(false);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un compte portail client</DialogTitle>
          <DialogDescription>
            Le client recevra ses identifiants via vous. Le mot de passe temporaire ne s'affiche qu'une seule fois.
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <Alert>
              <KeyRound className="h-4 w-4" />
              <AlertTitle>Mot de passe temporaire</AlertTitle>
              <AlertDescription>
                Communiquez ce mot de passe au client de manière sécurisée. Il ne sera plus visible.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Input value={tempPassword} readOnly className="font-mono" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label="Valider">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cp-name">Nom complet</Label>
              <Input id="cp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-email">Email</Label>
              <Input id="cp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {!etablissementId && (
              <div className="space-y-2">
                <Label>Établissement</Label>
                <Popover open={etabSearchOpen} onOpenChange={setEtabSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={etabSearchOpen}
                      className={cn("w-full justify-between font-normal", !etabId && "text-muted-foreground")}
                    >
                      {selectedEtab ? (
                        <span className="truncate">
                          {selectedEtab.nom}
                          {selectedEtab.ville && <span className="text-muted-foreground"> · {selectedEtab.ville}</span>}
                        </span>
                      ) : "Sélectionner un établissement..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Rechercher (nom, ville, région, code postal)..."
                        value={etabSearch}
                        onValueChange={setEtabSearch}
                      />
                      <CommandList>
                        <CommandEmpty>Aucun établissement trouvé.</CommandEmpty>
                        <CommandGroup>
                          {filteredEtabs.slice(0, 50).map((e: any) => (
                            <CommandItem
                              key={e.id}
                              value={e.id}
                              onSelect={() => {
                                setEtabId(e.id);
                                setEtabSearchOpen(false);
                                setEtabSearch("");
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", etabId === e.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{e.nom}</span>
                                {(e.ville || e.region) && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {[e.ville, e.code_postal, e.region].filter(Boolean).join(' · ')}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>Annuler</Button>
              <Button type="submit" disabled={create.isPending || !etabId}>
                {create.isPending ? "Création..." : "Créer le compte"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
