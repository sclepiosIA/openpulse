import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMyEmailTransfers, deleteEmailTransfer } from "@/services/email/emailTransfers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/shared/use-toast";
import { Copy, Trash2, FileArchive, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface TransferRow {
  id: string;
  token: string;
  subject: string | null;
  expires_at: string;
  file_count: number;
  total_size_bytes: number;
  download_count: number;
  purged_at: string | null;
  created_at: string;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} Mo`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

export function MyTransfersSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["my-email-transfers"],
    queryFn: async () => {
      return (await fetchMyEmailTransfers({ limit: 50 })) as TransferRow[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteEmailTransfer(id);
    },
    onSuccess: () => {
      toast({ title: "Transfert supprimé" });
      qc.invalidateQueries({ queryKey: ["my-email-transfers"] });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/transfer/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Lien copié" });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (transfers.length === 0)
    return <p className="text-sm text-muted-foreground">Aucun transfert pour le moment.</p>;

  return (
    <div className="space-y-2">
      {transfers.map((t) => {
        const expired = new Date(t.expires_at) < new Date() || !!t.purged_at;
        return (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <FileArchive className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium truncate">{t.subject || "Sans objet"}</span>
                {expired && <Badge variant="secondary">Expiré</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>{t.file_count} fichier(s) · {fmtSize(t.total_size_bytes)}</span>
                <span>{t.download_count} téléchargement(s)</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {expired
                    ? "Expiré"
                    : `Expire ${formatDistanceToNow(new Date(t.expires_at), { addSuffix: true, locale: fr })}`}
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              {!expired && (
                <Button variant="ghost" size="icon" onClick={() => copyLink(t.token)} title="Copier le lien">
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(t.id)}
                disabled={deleteMutation.isPending}
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
