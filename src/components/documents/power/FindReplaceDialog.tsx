/**
 * Find & Replace pour éditeur TipTap.
 * Recherche insensible à la casse, regex, remplacement un-par-un ou global.
 * Office-parity : Ctrl+F ouvre en mode `find`, Ctrl+H en mode `replace`
 * (le champ « Remplacer par » prend le focus). Entrée = suivant,
 * Maj+Entrée = précédent, Échap = fermer.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Search, ChevronUp, ChevronDown, Replace, ReplaceAll } from 'lucide-react';
import { toast } from 'sonner';
import type { Editor } from '@tiptap/react';

interface FindReplaceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editor: Editor | null;
  /** Champ à focus à l'ouverture : `find` (défaut, Ctrl+F) ou `replace` (Ctrl+H). */
  initialFocus?: 'find' | 'replace';
}

export function FindReplaceDialog({ open, onOpenChange, editor, initialFocus = 'find' }: FindReplaceDialogProps) {
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);

  const text = useMemo(() => {
    if (!editor || !open) return '';
    return editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n');
  }, [editor, open, query]);

  const regex = useMemo(() => {
    if (!query) return null;
    try {
      let src = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWord && !useRegex) src = `\\b${src}\\b`;
      return new RegExp(src, caseSensitive ? 'g' : 'gi');
    } catch {
      return null;
    }
  }, [query, caseSensitive, useRegex, wholeWord]);

  const matches = useMemo(() => {
    if (!regex || !text) return [];
    const arr: Array<{ start: number; end: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      arr.push({ start: m.index, end: m.index + m[0].length });
    }
    return arr;
  }, [regex, text]);

  useEffect(() => {
    setMatchIndex(0);
  }, [query, caseSensitive, useRegex, wholeWord]);

  // Convertit une position texte (avec \n séparateurs) en position ProseMirror.
  const textPosToDocPos = useCallback(
    (tPos: number): number => {
      if (!editor) return 0;
      let remaining = tPos;
      let docPos = 0;
      editor.state.doc.descendants((node, pos) => {
        if (remaining < 0) return false;
        if (node.isText) {
          const len = node.text?.length ?? 0;
          if (remaining <= len) {
            docPos = pos + remaining;
            remaining = -1;
            return false;
          }
          remaining -= len;
        } else if (node.isBlock && pos > 0) {
          if (remaining === 0) {
            docPos = pos;
            remaining = -1;
            return false;
          }
          remaining -= 1; // \n séparateur
        }
        return true;
      });
      return docPos;
    },
    [editor],
  );

  const jumpTo = useCallback(
    (idx: number) => {
      if (!editor || matches.length === 0) return;
      const safe = ((idx % matches.length) + matches.length) % matches.length;
      const m = matches[safe];
      const from = textPosToDocPos(m.start);
      const to = textPosToDocPos(m.end);
      editor.commands.setTextSelection({ from, to });
      editor.commands.scrollIntoView();
      setMatchIndex(safe);
    },
    [editor, matches, textPosToDocPos],
  );

  const replaceOne = () => {
    if (!editor || matches.length === 0) return;
    const m = matches[matchIndex];
    const from = textPosToDocPos(m.start);
    const to = textPosToDocPos(m.end);
    editor.chain().focus().setTextSelection({ from, to }).insertContent(replacement).run();
    toast.success('Occurrence remplacée');
  };

  const replaceAll = () => {
    if (!editor || matches.length === 0) return;
    // Remplace de la fin vers le début pour ne pas invalider les positions.
    editor.chain().focus().run();
    let count = 0;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const from = textPosToDocPos(m.start);
      const to = textPosToDocPos(m.end);
      editor.chain().setTextSelection({ from, to }).insertContent(replacement).run();
      count++;
    }
    toast.success(`${count} occurrence(s) remplacée(s)`);
  };

  useEffect(() => {
    if (open && matches.length > 0) jumpTo(0);
  }, [open, matches.length]);

  // Focus management Office-parity : Ctrl+F → champ Rechercher, Ctrl+H → Remplacer par.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const target = initialFocus === 'replace' ? replaceInputRef.current : findInputRef.current;
      target?.focus();
      target?.select();
    }, 30);
    return () => clearTimeout(t);
  }, [open, initialFocus]);

  const onFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      jumpTo(e.shiftKey ? matchIndex - 1 : matchIndex + 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Rechercher & remplacer
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs" htmlFor="fr-find">Rechercher</Label>
            <Input id="fr-find" ref={findInputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onFieldKeyDown} placeholder="Texte ou motif..." />
          </div>
          <div>
            <Label className="text-xs" htmlFor="fr-replace">Remplacer par</Label>
            <Input id="fr-replace" ref={replaceInputRef} value={replacement} onChange={(e) => setReplacement(e.target.value)} onKeyDown={onFieldKeyDown} placeholder="Remplacement..." />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <label className="flex items-center gap-2">
              <Switch checked={caseSensitive} onCheckedChange={setCaseSensitive} /> Casse
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={wholeWord} onCheckedChange={setWholeWord} /> Mot entier
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={useRegex} onCheckedChange={setUseRegex} /> Regex
            </label>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              {matches.length === 0 ? 'Aucun résultat' : `${matchIndex + 1} / ${matches.length}`}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => jumpTo(matchIndex - 1)} disabled={matches.length === 0}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => jumpTo(matchIndex + 1)} disabled={matches.length === 0}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={replaceOne} disabled={matches.length === 0} className="gap-1">
                <Replace className="h-3.5 w-3.5" /> Remplacer
              </Button>
              <Button size="sm" onClick={replaceAll} disabled={matches.length === 0} className="gap-1">
                <ReplaceAll className="h-3.5 w-3.5" /> Tout
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
