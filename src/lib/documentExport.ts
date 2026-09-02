/**
 * Document export/import utilities for the native document editor.
 * - PDF export (html2pdf.js) : préserve la mise en page (styles inline, images, tables).
 * - DOCX export (docx)       : conversion enrichie HTML → OOXML :
 *     paragraphes, headings, listes imbriquées, tables (avec bordures), images
 *     (data URI PNG/JPG), liens externes, gras/italique/souligné/barré,
 *     couleurs de police, tailles, alignement, blockquote, hr.
 * - DOCX import (mammoth)    : conversion DOCX → HTML sécurisé.
 */

import DOMPurify from 'dompurify';

// Config DOMPurify : autorise styles inline pour le rendu PDF, bloque scripts/handlers/javascript:
const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'width', 'height', 'style', 'class',
    'colspan', 'rowspan', 'align', 'valign', 'border', 'cellpadding', 'cellspacing',
    'target', 'rel',
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
};

// ──── PDF Export ────

export async function exportToPdf(html: string, filename: string): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;

  const container = document.createElement('div');
  container.innerHTML = DOMPurify.sanitize(html, SANITIZE_CONFIG) as unknown as string;
  container.style.cssText =
    'padding: 40px; font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.6; max-width: 800px;';
  document.body.appendChild(container);

  try {
    await html2pdf()
      .set({
        margin: [15, 15, 15, 15],
        filename: `${filename.replace(/\.[^.]+$/, '')}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        enableLinks: true,
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}

// ──── DOCX Export (enrichi) ────

type DocxMods = typeof import('docx');
type RunFormat = {
  bold?: boolean;
  italics?: boolean;
  underline?: {};
  strike?: boolean;
  color?: string; // hex sans #
  size?: number; // half-points
  font?: string;
};

/** Extrait la couleur hex (sans #) depuis un style CSS (color / background-color). */
function cssColorToHex(cssColor: string | null | undefined): string | undefined {
  if (!cssColor) return undefined;
  const s = cssColor.trim();
  const hexMatch = s.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return h.slice(0, 6).toUpperCase();
  }
  const rgbMatch = s.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((p) => parseInt(p.trim(), 10));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return parts
        .slice(0, 3)
        .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    }
  }
  return undefined;
}

/** Décode une image data URI en Uint8Array + type. */
function decodeDataUri(src: string): { data: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp' } | null {
  const m = src.match(/^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i);
  if (!m) return null;
  const type = m[1].toLowerCase() === 'jpeg' || m[1].toLowerCase() === 'jpg' ? 'jpg' : (m[1].toLowerCase() as 'png' | 'gif' | 'bmp');
  try {
    const bin = atob(m[2]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { data: out, type };
  } catch {
    return null;
  }
}

export async function exportToDocx(html: string, filename: string): Promise<void> {
  const docxLib: DocxMods = await import('docx');
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    ExternalHyperlink,
    ImageRun,
    BorderStyle,
    WidthType,
    LevelFormat,
    PageBreak,
  } = docxLib;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];

  // Collecte les runs d'un nœud (texte + inline formatting + liens + images).
  const collectRuns = (
    node: Node,
    inherited: RunFormat,
  ): Array<InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink> | InstanceType<typeof ImageRun>> => {
    const runs: Array<InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink> | InstanceType<typeof ImageRun>> = [];

    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        if (text.length === 0) return;
        runs.push(new TextRun({ text, ...inherited }));
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // Format inline
      const nextFmt: RunFormat = { ...inherited };
      if (tag === 'strong' || tag === 'b') nextFmt.bold = true;
      if (tag === 'em' || tag === 'i') nextFmt.italics = true;
      if (tag === 'u') nextFmt.underline = {};
      if (tag === 's' || tag === 'del' || tag === 'strike') nextFmt.strike = true;
      if (tag === 'code') nextFmt.font = 'Courier New';

      // Style inline color / font-size
      const inlineColor = cssColorToHex(el.style?.color);
      if (inlineColor) nextFmt.color = inlineColor;
      const fs = el.style?.fontSize;
      if (fs) {
        const px = parseFloat(fs);
        if (Number.isFinite(px) && px > 0) nextFmt.size = Math.round((px * 3) / 2); // px→half-points ~
      }

      // Line break
      if (tag === 'br') {
        runs.push(new TextRun({ text: '', break: 1 }));
        return;
      }

      // Image inline (data URI)
      if (tag === 'img') {
        const src = el.getAttribute('src') || '';
        const decoded = decodeDataUri(src);
        if (decoded) {
          const w = parseInt(el.getAttribute('width') || '0', 10) || 400;
          const h = parseInt(el.getAttribute('height') || '0', 10) || 300;
          try {
            runs.push(
              new ImageRun({
                type: decoded.type,
                data: decoded.data,
                transformation: { width: w, height: h },
                altText: {
                  title: el.getAttribute('alt') || 'image',
                  description: el.getAttribute('alt') || 'image',
                  name: el.getAttribute('alt') || 'image',
                },
              } as never),
            );
          } catch {
            // ignore image decode issues
          }
        }
        return;
      }

      // Lien externe
      if (tag === 'a' && el.getAttribute('href')) {
        const href = el.getAttribute('href')!;
        const inner = collectRuns(el, { ...nextFmt, color: nextFmt.color || '0563C1', underline: {} }) as InstanceType<typeof TextRun>[];
        runs.push(
          new ExternalHyperlink({
            link: href,
            children: inner.length > 0 ? inner : [new TextRun({ text: el.textContent || href, ...nextFmt })],
          }),
        );
        return;
      }

      // Récursion pour les autres inline
      runs.push(...collectRuns(el, nextFmt));
    });

    return runs;
  };

  const paragraphFromInline = (
    el: HTMLElement,
    opts: {
      heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
      bulletLevel?: number;
      numberedLevel?: number;
      indentLeft?: number;
      italicsAll?: boolean;
    } = {},
  ): InstanceType<typeof Paragraph> => {
    const align = el.style?.textAlign;
    const inheritedItalics: RunFormat = opts.italicsAll ? { italics: true } : {};
    const runs = collectRuns(el, inheritedItalics);

    return new Paragraph({
      heading: opts.heading,
      children: runs.length > 0 ? (runs as InstanceType<typeof TextRun>[]) : [new TextRun('')],
      alignment:
        align === 'center' ? AlignmentType.CENTER
        : align === 'right' ? AlignmentType.RIGHT
        : align === 'justify' ? AlignmentType.JUSTIFIED
        : AlignmentType.LEFT,
      bullet: opts.bulletLevel != null ? { level: opts.bulletLevel } : undefined,
      numbering: opts.numberedLevel != null ? { reference: 'ordered', level: opts.numberedLevel } : undefined,
      indent: opts.indentLeft != null ? { left: opts.indentLeft } : undefined,
    });
  };

  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: 'BFBFBF',
  };
  const cellBorders = { top: border, bottom: border, left: border, right: border };

  const buildTable = (tableEl: HTMLTableElement): InstanceType<typeof Table> | null => {
    const rows: InstanceType<typeof TableRow>[] = [];
    const trList = Array.from(tableEl.querySelectorAll('tr'));
    if (trList.length === 0) return null;
    const maxCols = Math.max(...trList.map((tr) => tr.querySelectorAll('th,td').length));
    const colWidth = Math.floor(9000 / Math.max(1, maxCols));

    trList.forEach((tr, rIdx) => {
      const cells = Array.from(tr.querySelectorAll('th,td')) as HTMLTableCellElement[];
      const isHeader = rIdx === 0 && tr.querySelector('th') != null;
      const tableCells = cells.map((cell) => {
        const bgHex = cssColorToHex(cell.style?.backgroundColor) || (isHeader ? 'E7E6E6' : undefined);
        const paragraphs = processBlockChildren(cell);
        return new TableCell({
          borders: cellBorders,
          width: { size: colWidth, type: WidthType.DXA },
          shading: bgHex ? { fill: bgHex, type: 'clear' as never, color: 'auto' } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun('')] })],
          columnSpan: parseInt(cell.getAttribute('colspan') || '1', 10) || undefined,
          rowSpan: parseInt(cell.getAttribute('rowspan') || '1', 10) || undefined,
        });
      });
      rows.push(new TableRow({ children: tableCells, tableHeader: isHeader }));
    });

    return new Table({
      rows,
      width: { size: 9000, type: WidthType.DXA },
      columnWidths: Array.from({ length: maxCols }, () => colWidth),
    });
  };

  const processBlockChildren = (root: HTMLElement): InstanceType<typeof Paragraph>[] => {
    const out: InstanceType<typeof Paragraph>[] = [];
    // Si le nœud n'a que du texte inline, on l'emballe dans un paragraphe.
    const hasBlockChild = Array.from(root.children).some((c) =>
      ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'HR', 'TABLE'].includes(c.tagName),
    );
    if (!hasBlockChild) {
      out.push(paragraphFromInline(root));
      return out;
    }
    root.childNodes.forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const t = el.tagName.toLowerCase();
      if (t === 'h1') out.push(paragraphFromInline(el, { heading: HeadingLevel.HEADING_1 }));
      else if (t === 'h2') out.push(paragraphFromInline(el, { heading: HeadingLevel.HEADING_2 }));
      else if (t === 'h3') out.push(paragraphFromInline(el, { heading: HeadingLevel.HEADING_3 }));
      else if (t === 'h4') out.push(paragraphFromInline(el, { heading: HeadingLevel.HEADING_4 }));
      else if (t === 'h5') out.push(paragraphFromInline(el, { heading: HeadingLevel.HEADING_5 }));
      else if (t === 'h6') out.push(paragraphFromInline(el, { heading: HeadingLevel.HEADING_6 }));
      else if (t === 'p') out.push(paragraphFromInline(el));
      else if (t === 'ul' || t === 'ol') out.push(...processList(el, t === 'ol', 0));
      else if (t === 'blockquote') out.push(paragraphFromInline(el, { indentLeft: 720, italicsAll: true }));
      else if (t === 'pre') out.push(paragraphFromInline(el));
      else if (t === 'hr') {
        out.push(
          new Paragraph({
            children: [new TextRun('')],
            border: { bottom: { color: 'BFBFBF', style: BorderStyle.SINGLE, size: 6, space: 1 } },
          }),
        );
      } else {
        // Éléments inconnus : on tente le récursif ; sinon on retombe sur paragraphe simple.
        out.push(paragraphFromInline(el));
      }
    });
    return out;
  };

  const processList = (listEl: HTMLElement, ordered: boolean, level: number): InstanceType<typeof Paragraph>[] => {
    const out: InstanceType<typeof Paragraph>[] = [];
    Array.from(listEl.children).forEach((li) => {
      if (li.tagName !== 'LI') return;
      const liEl = li as HTMLElement;
      // Contenu direct du <li> (hors sous-listes)
      const inlineOnly = document.createElement('div');
      Array.from(liEl.childNodes).forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) {
          const t = (n as HTMLElement).tagName.toLowerCase();
          if (t === 'ul' || t === 'ol') return;
        }
        inlineOnly.appendChild(n.cloneNode(true));
      });
      out.push(
        paragraphFromInline(inlineOnly, ordered ? { numberedLevel: level } : { bulletLevel: level }),
      );
      // Sous-listes imbriquées
      Array.from(liEl.children).forEach((c) => {
        if (c.tagName === 'UL') out.push(...processList(c as HTMLElement, false, level + 1));
        if (c.tagName === 'OL') out.push(...processList(c as HTMLElement, true, level + 1));
      });
    });
    return out;
  };

  // Parcours top-level body : tables au niveau racine + reste.
  doc.body.childNodes.forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent?.trim();
        if (t) children.push(new Paragraph({ children: [new TextRun(t)] }));
      }
      return;
    }
    const el = child as HTMLElement;
    if (el.tagName === 'TABLE') {
      const tbl = buildTable(el as HTMLTableElement);
      if (tbl) children.push(tbl);
      // paragraphe vide après table pour éviter le collage
      children.push(new Paragraph({ children: [new TextRun('')] }));
      return;
    }
    const blockRoot = document.createElement('div');
    blockRoot.appendChild(el.cloneNode(true));
    children.push(...processBlockChildren(blockRoot));
  });

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('')] }));
  }

  const finalDoc = new Document({
    numbering: {
      config: [
        {
          reference: 'ordered',
          levels: [0, 1, 2, 3].map((lvl) => ({
            level: lvl,
            format: LevelFormat.DECIMAL,
            text: `%${lvl + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (lvl + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // ~2cm
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(finalDoc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace(/\.[^.]+$/, '')}.docx`;
  a.click();
  URL.revokeObjectURL(url);

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  PageBreak; // avoid unused import warning when the helper isn't used inline
}

// ──── DOCX Import ────

export async function importDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  if (result.messages.length > 0) {
    console.warn('Mammoth conversion warnings:', result.messages);
  }

  // Défense en profondeur : sanitize le HTML avant injection dans l'éditeur
  return DOMPurify.sanitize(result.value, SANITIZE_CONFIG) as unknown as string;
}
