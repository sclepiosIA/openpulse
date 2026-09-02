/**
 * VersionHistoryDialog — panneau d'historique des versions d'un document.
 *
 * Fonctionnalités : lister, nommer, supprimer, comparer (diff avant/après
 * ligne à ligne) et restaurer une version à un instant donné.
 * Fonctionne pour les 3 éditeurs (HTML pour Document, JSON pour Tableur et
 * Présentation) via `kind` + callback `onRestore`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { History, Save, RotateCcw, Trash2, Pencil, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  listVersions,
  saveVersion,
  renameVersion,
  deleteVersion,
  diffLines,
  normalizeForDiff,
  summarizeDiff,
  type DocumentVersion,
  type VersionKind,
} from './versionHistory';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string;
  documentName: string;
  kind: VersionKind;
  /** Contenu courant (HTML pour Document, JSON string pour Tableur/Présentation). */
  getCurrentContent: () => string;
  /** Appelé quand l'utilisateur restaure une version. */
  onRestore: (content: string, version: DocumentVersion) => void;
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  kind,
  getCurrentContent,
  onRestore,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmRestore, setConfirmRestore] = useState<DocumentVersion | null>(null);
  const [saveName, setSaveName] = useState('');

  const refresh = useCallback(async () => {
    if (!documentId) { setVersions([]); return; }
    const list = await listVersions(documentId);
    setVersions(list);
    if (list.length && (!selectedId || !list.some((v) => v.id === selectedId))) {
      setSelectedId(list[0].id);
    }
  }, [documentId, selectedId]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const selected = useMemo(
    () => versions.find((v) => v.id === selectedId) ?? null,
    [versions, selectedId],
  );

  const diffOps = useMemo(() => {
    if (!selected) return [];
    const current = normalizeForDiff(getCurrentContent(), kind);
    const past = normalizeForDiff(selected.content, kind);
    return diffLines(past, current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, kind]);
  const diffSummary = useMemo(() => summarizeDiff(diffOps), [diffOps]);

  const handleSaveVersion = async () => {
    if (!documentId) {
      toast.error('Enregistrez le document avant de créer une version');
      return;
    }
    const content = getCurrentContent();
    const v = await saveVersion(documentId, content, kind, { name: saveName || undefined, auto: false });
    if (v) {
      toast.success(`Version « ${v.name} » créée`);
      setSaveName('');
      await refresh();
      setSelectedId(v.id);
    }
  };

  const handleRestore = async (version: DocumentVersion) => {
    // Snapshot défensif AVANT restauration pour permettre un rollback immédiat.
    if (documentId) {
      await saveVersion(documentId, getCurrentContent(), kind, { auto: true, name: 'Avant restauration' });
    }
    onRestore(version.content, version);
    toast.success(`Restauré : « ${version.name} »`);
    setConfirmRestore(null);
    onOpenChange(false);
  };

  const handleRename = async (versionId: string) => {
    if (!documentId) return;
    if (!renameValue.trim()) { setRenamingId(null); return; }
    await renameVersion(documentId, versionId, renameValue);
    setRenamingId(null);
    await refresh();
  };

  const handleDelete = async (versionId: string) => {
    if (!documentId) return;
    await deleteVersion(documentId, versionId);
    if (selectedId === versionId) setSelectedId(null);
    await refresh();
    toast.success('Version supprimée');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique des versions — {documentName}
            </DialogTitle>
            <DialogDescription>
              Créez, nommez, comparez et restaurez des versions antérieures.
              L'état courant est comparé à la version sélectionnée.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr]">
            {/* Liste des versions */}
            <div className="border-r flex flex-col min-h-0">
              <div className="p-3 border-b space-y-2 bg-muted/20">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nom (optionnel)"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveVersion()}
                  />
                  <Button size="sm" onClick={handleSaveVersion} className="h-8 gap-1 shrink-0">
                    <Save className="h-3.5 w-3.5" /> Créer
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {versions.length} version{versions.length > 1 ? 's' : ''} — 50 max.
                </p>
              </div>
              <ScrollArea className="flex-1">
                {versions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Aucune version enregistrée pour l'instant.
                  </div>
                ) : (
                  <ul className="p-2 space-y-1">
                    {versions.map((v) => {
                      const active = v.id === selectedId;
                      const isRenaming = renamingId === v.id;
                      return (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => !isRenaming && setSelectedId(v.id)}
                            className={cn(
                              'w-full text-left rounded-md border px-2.5 py-2 text-xs transition-colors',
                              active ? 'bg-primary/10 border-primary/40' : 'bg-background hover:bg-muted/60 border-transparent',
                            )}
                          >
                            {isRenaming ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRename(v.id);
                                    if (e.key === 'Escape') setRenamingId(null);
                                  }}
                                  className="h-7 text-xs"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); handleRename(v.id); }}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); setRenamingId(null); }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium truncate">{v.name}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {new Date(v.createdAt).toLocaleString('fr-FR')}
                                    </div>
                                  </div>
                                  {v.auto && (
                                    <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                                      auto
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-1.5 flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground">
                                    {(v.size / 1024).toFixed(1)} Ko
                                  </span>
                                  <div className="ml-auto flex items-center gap-0.5">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      title="Renommer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRenamingId(v.id);
                                        setRenameValue(v.name);
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      title="Supprimer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(v.id);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </div>

            {/* Panneau diff */}
            <div className="flex flex-col min-h-0">
              {selected ? (
                <>
                  <div className="px-4 py-3 border-b bg-muted/10 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{selected.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Diff : version → contenu actuel
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <span className="text-emerald-600">+{diffSummary.added}</span>
                        <span className="text-rose-600">−{diffSummary.removed}</span>
                      </Badge>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setConfirmRestore(selected)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restaurer
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <pre className="text-[11px] font-mono leading-relaxed p-4 whitespace-pre-wrap break-words">
                      {diffOps.length === 0 ? (
                        <span className="text-muted-foreground">Contenu identique.</span>
                      ) : (
                        diffOps.map((op, i) => (
                          <div
                            key={i}
                            className={cn(
                              'px-2 -mx-2 rounded',
                              op.type === 'add' && 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
                              op.type === 'del' && 'bg-rose-500/10 text-rose-900 dark:text-rose-200 line-through',
                              op.type === 'equal' && 'text-muted-foreground',
                            )}
                          >
                            <span className="opacity-60 select-none mr-2">
                              {op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' '}
                            </span>
                            {op.line || '\u00A0'}
                          </div>
                        ))
                      )}
                    </pre>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                  <div className="max-w-sm space-y-2">
                    <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Sélectionnez une version pour visualiser les différences,
                      ou créez une première version depuis le panneau de gauche.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t bg-muted/10">
            <p className="text-[11px] text-muted-foreground mr-auto">
              Versions synchronisées dans le cloud (fallback local hors-ligne).
            </p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRestore} onOpenChange={(o) => !o && setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer cette version ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le contenu actuel sera remplacé par « {confirmRestore?.name} ». Une
              sauvegarde automatique de l'état courant est créée juste avant la
              restauration : vous pourrez y revenir depuis l'historique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRestore && handleRestore(confirmRestore)}>
              Restaurer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
