/**
 * Barre de statistiques temps réel : mots, caractères, pages, temps de lecture.
 */
import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { FileText, Clock } from 'lucide-react';

interface Props {
  editor: Editor | null;
}

function computeStats(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const pages = Math.max(1, Math.ceil(words / 250));
  const readingMinutes = Math.max(1, Math.ceil(words / 220));
  return { words, chars, charsNoSpace, pages, readingMinutes };
}

export function WordCountBar({ editor }: Props) {
  const [stats, setStats] = useState({ words: 0, chars: 0, charsNoSpace: 0, pages: 1, readingMinutes: 1 });

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n');
      setStats(computeStats(text));
    };
    update();
    editor.on('update', update);
    return () => {
      editor.off('update', update);
    };
  }, [editor]);

  return (
    <div className="flex items-center gap-4 px-3 py-1 border-t bg-muted/10 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <FileText className="h-3 w-3" />
        {stats.words} mots · {stats.chars} car. ({stats.charsNoSpace} sans esp.)
      </span>
      <span>~ {stats.pages} page{stats.pages > 1 ? 's' : ''}</span>
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" /> {stats.readingMinutes} min de lecture
      </span>
    </div>
  );
}
