/**
 * Publipostage : upload CSV, mappe colonnes → placeholders {{col}}, génère N documents
 * en zip (JSZip natif via Blob concat CSV, sinon export ligne à ligne HTML).
 */
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { exportToPdf } from '@/lib/documentExport';
import type { Editor } from '@tiptap/react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editor: Editor | null;
  documentName: string;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const parseLine = (l: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') {
        if (inQ && l[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => { rec[h] = vals[i] ?? ''; });
    return rec;
  });
}

function applyTemplate(html: string, row: Record<string, string>): string {
  return html.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
    const v = row[k];
    // échappe HTML basique
    return v == null ? '' : String(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  });
}

export function MailMergeDialog({ open, onOpenChange, editor, documentName }: Props) {
  const [csvText, setCsvText] = useState('');
  const [nameField, setNameField] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => parseCsv(csvText), [csvText]);
  const headers = rows[0] ? Object.keys(rows[0]) : [];

  const placeholders = useMemo(() => {
    if (!editor) return [];
    const html = editor.getHTML();
    const set = new Set<string>();
    html.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => { set.add(k); return ''; });
    return Array.from(set);
  }, [editor, open]);

  const handleFile = async (f: File) => {
    const t = await f.text();
    setCsvText(t);
  };

  const generate = async () => {
    if (!editor || rows.length === 0) return;
    setBusy(true);
    try {
      const template = editor.getHTML();
      for (let i = 0; i < rows.length; i++) {
        const merged = applyTemplate(template, rows[i]);
        const filename = nameField && rows[i][nameField]
          ? `${documentName}-${rows[i][nameField]}`
          : `${documentName}-${i + 1}`;
        await exportToPdf(merged, filename);
      }
      toast.success(`${rows.length} document(s) générés`);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors du publipostage');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Publipostage</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded border bg-muted/30 p-2 text-xs">
            Placeholders détectés dans le document :{' '}
            {placeholders.length === 0 ? (
              <span className="text-muted-foreground">aucun (insérez <code>{'{{colonne}}'}</code> dans le texte)</span>
            ) : (
              placeholders.map((p) => <code key={p} className="mx-1 rounded bg-background px-1">{`{{${p}}}`}</code>)
            )}
          </div>
          <div>
            <Label className="text-xs">Fichier CSV (première ligne = entêtes)</Label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
          </div>
          <div>
            <Label className="text-xs">Ou coller le CSV</Label>
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={6}
              placeholder="nom,prenom,email&#10;Dupont,Jean,jean@ex.com"
              className="font-mono text-xs"
            />
          </div>
          {headers.length > 0 && (
            <div className="text-xs">
              <div>Colonnes détectées : <span className="font-mono">{headers.join(', ')}</span></div>
              <div>Lignes : <strong>{rows.length}</strong></div>
              <Label className="mt-2 text-xs">Colonne pour nommer les fichiers</Label>
              <select value={nameField} onChange={(e) => setNameField(e.target.value)} className="w-full rounded border px-2 py-1">
                <option value="">— index —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={generate} disabled={busy || rows.length === 0 || placeholders.length === 0}>
            {busy ? 'Génération…' : `Générer ${rows.length} PDF`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
