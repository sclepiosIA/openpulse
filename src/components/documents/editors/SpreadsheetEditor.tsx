import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { Save, FileDown, FileUp, BarChart3, Palette, Search, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNativeDocumentSave } from '@/hooks/documents/useNativeDocumentSave'
import { loadPdfLibs, loadExcelLibs } from '@/lib/export/dynamicPdfImport'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { EditorHeader, EditorCloseButton, EditorAIButton } from './EditorChrome'
import { FormulaAssistantDialog } from '@/components/documents/ai/copilot/FormulaAssistantDialog'
import { CopilotSidePanel } from '@/components/documents/ai/copilot/CopilotSidePanel'
import { FormulaEngine } from '@/components/documents/power/formulaEngine'
import { importXlsx } from '@/components/documents/power/importXlsx'
import { ChartInsertDialog } from '@/components/documents/power/ChartInsertDialog'
import {
  ConditionalFormattingDialog,
  evaluateCfRule,
  type CfRule,
} from '@/components/documents/power/ConditionalFormattingDialog'
import { VersionHistoryDialog } from '@/components/documents/power/VersionHistoryDialog'
import { saveVersion } from '@/components/documents/power/versionHistory'
import { useUndoRedo, matchUndoRedo, isTypingTarget } from '@/hooks/documents/useUndoRedo'
import { useRealtimeCoedit } from '@/hooks/documents/useRealtimeCoedit'

// SVG sanitization strict (audit P0 — Sprint 1) : autorise uniquement SVG statique.
const SVG_SANITIZE_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'foreignObject'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
}

interface SpreadsheetEditorProps {
  documentId?: string
  documentName?: string
  initialContent?: string
  folderId?: string | null
  onClose?: () => void
  className?: string
  collaborative?: boolean
}

interface CellData {
  value: string
  formula?: string
  format?: {
    bold?: boolean
    italic?: boolean
    align?: 'left' | 'center' | 'right'
    bgColor?: string
    textColor?: string
  }
}

type SheetData = Record<string, CellData>

interface SheetState {
  data: SheetData
  colCount: number
  rowCount: number
  colWidths: Record<number, number>
}

const DEFAULT_COL_COUNT = 26
const DEFAULT_ROW_COUNT = 100
const DEFAULT_COL_WIDTH = 100

function colLabel(index: number): string {
  let label = ''
  let n = index
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  }
  return label
}

function cellKey(row: number, col: number): string {
  return `${colLabel(col)}${row + 1}`
}

/**
 * Safe arithmetic evaluator: shunting-yard for + - * / ( ) and decimal numbers.
 * Never executes user-supplied code (no eval / Function).
 */
function safeEvalArithmetic(expr: string): number {
  const tokens: Array<{ t: 'n' | 'op' | 'p'; v: string }> = []
  let i = 0
  while (i < expr.length) {
    const c = expr[i]
    if (c === ' ') {
      i++
      continue
    }
    if ('+-*/()'.includes(c)) {
      tokens.push({ t: c === '(' || c === ')' ? 'p' : 'op', v: c })
      i++
      continue
    }
    if ((c >= '0' && c <= '9') || c === '.') {
      let j = i
      while (j < expr.length && ((expr[j] >= '0' && expr[j] <= '9') || expr[j] === '.')) j++
      tokens.push({ t: 'n', v: expr.slice(i, j) })
      i = j
      continue
    }
    throw new Error('invalid')
  }
  // Shunting-yard
  const out: typeof tokens = []
  const ops: typeof tokens = []
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }
  for (const tk of tokens) {
    if (tk.t === 'n') out.push(tk)
    else if (tk.v === '(') ops.push(tk)
    else if (tk.v === ')') {
      while (ops.length && ops[ops.length - 1].v !== '(') out.push(ops.pop()!)
      if (!ops.length) throw new Error('paren')
      ops.pop()
    } else {
      while (
        ops.length &&
        ops[ops.length - 1].v !== '(' &&
        prec[ops[ops.length - 1].v] >= prec[tk.v]
      ) {
        out.push(ops.pop()!)
      }
      ops.push(tk)
    }
  }
  while (ops.length) {
    const o = ops.pop()!
    if (o.v === '(') throw new Error('paren')
    out.push(o)
  }
  const stack: number[] = []
  for (const tk of out) {
    if (tk.t === 'n') stack.push(parseFloat(tk.v))
    else {
      const b = stack.pop()
      const a = stack.pop()
      if (a === undefined || b === undefined) throw new Error('arity')
      switch (tk.v) {
        case '+':
          stack.push(a + b)
          break
        case '-':
          stack.push(a - b)
          break
        case '*':
          stack.push(a * b)
          break
        case '/':
          stack.push(b === 0 ? NaN : a / b)
          break
      }
    }
  }
  if (stack.length !== 1) throw new Error('result')
  return stack[0]
}

function evaluateFormula(
  formula: string,
  data: SheetData,
  rowCount: number,
  colCount: number,
  engine: FormulaEngine
): string {
  if (!formula.startsWith('=')) return formula
  return engine.evaluateCell({ data, rowCount, colCount }, findKeyForFormula(formula, data) || 'A1')
}

// Retrouve la clé de la cellule qui contient exactement cette formule (première occurrence).
function findKeyForFormula(formula: string, data: SheetData): string | null {
  for (const [k, cell] of Object.entries(data)) {
    if (cell.formula === formula) return k
  }
  return null
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/i)
  if (!match) return null
  const colStr = match[1].toUpperCase()
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + colStr.charCodeAt(i) - 64
  }
  return { row: parseInt(match[2]) - 1, col: col - 1 }
}

export function SpreadsheetEditor({
  documentId,
  documentName = 'Tableur',
  initialContent,
  folderId,
  onClose,
  className,
  collaborative = false,
}: SpreadsheetEditorProps) {
  const { save: saveToNextcloud, isSaving: isNativeSaving } = useNativeDocumentSave({
    documentName,
    mimeType: 'application/json',
    extension: 'json',
    folderId,
    existingDocumentId: documentId,
  })
  const initialSheet = useMemo<SheetState>(() => {
    if (initialContent) {
      try {
        return JSON.parse(initialContent)
      } catch {
        /* ignore */
      }
    }
    return {
      data: {},
      colCount: DEFAULT_COL_COUNT,
      rowCount: DEFAULT_ROW_COUNT,
      colWidths: {},
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const {
    state: sheet,
    set: setSheet,
    undo: undoSheet,
    redo: redoSheet,
    reset: resetSheet,
  } = useUndoRedo<SheetState>(initialSheet)

  // Co-édition temps réel : broadcast débouncé du snapshot + présence
  const { connectedUsers: coeditUsers, isConnected: isCoeditConnected } =
    useRealtimeCoedit<SheetState>({
      documentId,
      enabled: !!collaborative && !!documentId,
      snapshot: sheet,
      onRemoteSnapshot: (remote) => resetSheet(remote),
      channelKind: 'sheet',
    })

  // Moteur de formules isolé (P0 audit) : chaque éditeur a sa propre instance
  // HyperFormula pour éviter la corruption silencieuse entre plusieurs tableurs.
  const engine = useMemo(() => new FormulaEngine(), [])
  useEffect(() => () => engine.destroy(), [engine])

  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [chartOpen, setChartOpen] = useState(false)
  const [cfOpen, setCfOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [cfRules, setCfRules] = useState<CfRule[]>([])
  const [charts, setCharts] = useState<Array<{ id: string; svg: string; title: string }>>([])
  const cellInputRef = useRef<HTMLInputElement>(null)
  const formulaBarRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  // Suivi "dirty" pour beforeunload (P0 audit) — passe à true à chaque mutation.
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = true
  }, [sheet])

  // Extraction contexte pour l'IA formule (première ligne = headers, 8 lignes échantillon).
  const { aiHeaders, aiSample } = useMemo(() => {
    const headers: string[] = []
    const sample: string[][] = []
    const cols = Math.min(sheet.colCount, 20)
    for (let c = 0; c < cols; c++) {
      const col = String.fromCharCode(65 + c)
      const key = `${col}1`
      const cell = sheet.data[key]
      headers.push(cell?.value || cell?.formula || col)
    }
    for (let r = 2; r <= Math.min(9, sheet.rowCount); r++) {
      const row: string[] = []
      for (let c = 0; c < cols; c++) {
        const col = String.fromCharCode(65 + c)
        const key = `${col}${r}`
        const cell = sheet.data[key]
        row.push(cell?.value ?? '')
      }
      if (row.some((v) => v && v.trim() !== '')) sample.push(row)
    }
    return { aiHeaders: headers, aiSample: sample }
  }, [sheet.data, sheet.colCount, sheet.rowCount])

  const getCellDisplay = useCallback(
    (key: string): string => {
      const cell = sheet.data[key]
      if (!cell) return ''
      if (cell.formula)
        return engine.evaluateCell(
          { data: sheet.data, rowCount: sheet.rowCount, colCount: sheet.colCount },
          key
        )
      return cell.value
    },
    [sheet.data, sheet.rowCount, sheet.colCount, engine]
  )

  const updateCell = useCallback((key: string, value: string) => {
    setSheet((prev) => {
      const newData = { ...prev.data }
      if (value === '') {
        delete newData[key]
      } else {
        newData[key] = {
          ...newData[key],
          value: value.startsWith('=') ? '' : value,
          formula: value.startsWith('=') ? value : undefined,
        }
      }
      return { ...prev, data: newData }
    })
  }, [])

  const handleCellDoubleClick = (key: string) => {
    setEditingCell(key)
    const cell = sheet.data[key]
    setEditValue(cell?.formula || cell?.value || '')
    setTimeout(() => cellInputRef.current?.focus(), 0)
  }

  const commitEdit = () => {
    if (editingCell) {
      updateCell(editingCell, editValue)
      setEditingCell(null)
    }
  }

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
      // Move down
      if (selectedCell) {
        const ref = parseCellRef(selectedCell)
        if (ref && ref.row < sheet.rowCount - 1) {
          const nextKey = cellKey(ref.row + 1, ref.col)
          setSelectedCell(nextKey)
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      if (selectedCell) {
        const ref = parseCellRef(selectedCell)
        if (ref && ref.col < sheet.colCount - 1) {
          const nextKey = cellKey(ref.row, ref.col + 1)
          setSelectedCell(nextKey)
        }
      }
    }
  }

  const handleSave = useCallback(async () => {
    if (isSaving || isNativeSaving) return // P0 audit : garde anti-doublon.
    setIsSaving(true)
    try {
      const json = JSON.stringify(sheet)
      const blob = new Blob([json], { type: 'application/json' })
      await saveToNextcloud(blob)
      setLastSaved(new Date())
      dirtyRef.current = false
      if (documentId) saveVersion(documentId, json, 'json', { auto: true })
      toast.success('Tableur enregistré')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, isNativeSaving, sheet, saveToNextcloud, documentId])

  // beforeunload : prévient la fermeture d'onglet si des changements sont non sauvegardés (P0 audit).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const handleExportCsv = useCallback(() => {
    let maxRow = 0,
      maxCol = 0
    Object.keys(sheet.data).forEach((key) => {
      const ref = parseCellRef(key)
      if (ref) {
        maxRow = Math.max(maxRow, ref.row)
        maxCol = Math.max(maxCol, ref.col)
      }
    })

    const rows: string[][] = []
    for (let r = 0; r <= maxRow; r++) {
      const row: string[] = []
      for (let c = 0; c <= maxCol; c++) {
        row.push(getCellDisplay(cellKey(r, c)))
      }
      rows.push(row)
    }

    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
              return `"${cell.replace(/"/g, '""')}"`
            }
            return cell
          })
          .join(',')
      )
      .join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${documentName.replace(/\.[^.]+$/, '')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exporté')
  }, [sheet.data, documentName, getCellDisplay])

  const getSheetBounds = useCallback(() => {
    let maxRow = 0,
      maxCol = 0
    Object.keys(sheet.data).forEach((key) => {
      const ref = parseCellRef(key)
      if (ref) {
        maxRow = Math.max(maxRow, ref.row)
        maxCol = Math.max(maxCol, ref.col)
      }
    })
    return { maxRow, maxCol }
  }, [sheet.data])

  const handleExportXlsx = useCallback(async () => {
    try {
      const { XLSX } = await loadExcelLibs()
      const { maxRow, maxCol } = getSheetBounds()

      // 1) Construit la feuille cellule par cellule pour conserver les formules
      const ws: Record<string, unknown> = {}
      for (let r = 0; r <= maxRow; r++) {
        for (let c = 0; c <= maxCol; c++) {
          const key = cellKey(r, c)
          const cell = sheet.data[key]
          if (!cell) continue
          const addr = XLSX.utils.encode_cell({ r, c })

          if (cell.formula && cell.formula.startsWith('=')) {
            // Cellule formule : on stocke l'expression + la valeur calculée courante
            const computed = getCellDisplay(key)
            const num = parseFloat(computed)
            const isNum = computed !== '' && !isNaN(num)
            ws[addr] = {
              t: isNum ? 'n' : 's',
              f: cell.formula.slice(1), // SheetJS attend la formule SANS '='
              v: isNum ? num : computed,
            }
          } else {
            const val = cell.value ?? ''
            const num = parseFloat(val)
            const isNum = val !== '' && !isNaN(num) && /^-?\d+(\.\d+)?$/.test(val.trim())
            ws[addr] = isNum ? { t: 'n', v: num } : { t: 's', v: val }
          }

          // Styles cellule (bold/italic/align/bg/text)
          const fmt = cell.format
          if (fmt) {
            ;(ws[addr] as any).s = {
              font: {
                bold: !!fmt.bold,
                italic: !!fmt.italic,
                color: fmt.textColor ? { rgb: fmt.textColor.replace('#', '') } : undefined,
              },
              alignment: { horizontal: fmt.align || 'left', vertical: 'center', wrapText: true },
              fill: fmt.bgColor
                ? { patternType: 'solid', fgColor: { rgb: fmt.bgColor.replace('#', '') } }
                : undefined,
            }
          }
        }
      }
      ws['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(0, maxRow), c: Math.max(0, maxCol) },
      })
      ws['!cols'] = Array.from({ length: maxCol + 1 }, (_, c) => ({
        wch: Math.round((sheet.colWidths[c] || DEFAULT_COL_WIDTH) / 7),
      }))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Feuille1')

      // 2) Feuille séparée pour les graphiques (SVG texte)
      if (charts.length > 0) {
        const chartsAoa: string[][] = [['Titre', 'SVG (source)']]
        charts.forEach((c) => {
          chartsAoa.push([c.title || 'Sans titre', c.svg])
        })
        const wsCharts = XLSX.utils.aoa_to_sheet(chartsAoa)
        wsCharts['!cols'] = [{ wch: 40 }, { wch: 120 }]
        XLSX.utils.book_append_sheet(wb, wsCharts, 'Graphiques')
      }

      XLSX.writeFile(wb, `${documentName.replace(/\.[^.]+$/, '')}.xlsx`)
      toast.success('XLSX exporté (formules & styles conservés)')
    } catch (err) {
      console.error('[XLSX export]', err)
      toast.error("Erreur lors de l'export XLSX")
    }
  }, [sheet, documentName, getCellDisplay, getSheetBounds, charts])

  const handleExportPdf = useCallback(async () => {
    try {
      const { jsPDF, autoTable } = await loadPdfLibs()
      const { maxRow, maxCol } = getSheetBounds()

      const doc = new jsPDF({ orientation: maxCol > 6 ? 'landscape' : 'portrait' })
      doc.setFontSize(16)
      doc.text(documentName.replace(/\.[^.]+$/, ''), 14, 18)

      const headers = Array.from({ length: maxCol + 1 }, (_, c) => colLabel(c))
      const body: string[][] = []
      for (let r = 0; r <= maxRow; r++) {
        const row: string[] = []
        for (let c = 0; c <= maxCol; c++) {
          row.push(getCellDisplay(cellKey(r, c)))
        }
        body.push(row)
      }

      autoTable(doc, {
        startY: 25,
        head: [headers],
        body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      })

      doc.save(`${documentName.replace(/\.[^.]+$/, '')}.pdf`)
      toast.success('PDF exporté avec succès')
    } catch {
      toast.error("Erreur lors de l'export PDF")
    }
  }, [documentName, getCellDisplay, getSheetBounds])

  // Navigation clavier (arrow keys + Enter/Tab traités déjà en cellule).
  const moveSelection = useCallback(
    (dRow: number, dCol: number) => {
      setSelectedCell((prev) => {
        const ref = prev ? parseCellRef(prev) : { row: 0, col: 0 }
        if (!ref) return prev
        const nextRow = Math.max(0, Math.min(sheet.rowCount - 1, ref.row + dRow))
        const nextCol = Math.max(0, Math.min(sheet.colCount - 1, ref.col + dCol))
        return cellKey(nextRow, nextCol)
      })
    },
    [sheet.rowCount, sheet.colCount]
  )

  // Raccourcis clavier globaux (Ctrl+S, Ctrl+F/H, Ctrl+Z/Y, F2, Delete, flèches).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
        return
      }
      const ur = matchUndoRedo(e)
      if (ur && !typing) {
        e.preventDefault()
        if (ur === 'undo') undoSheet()
        else redoSheet()
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'h')) {
        e.preventDefault()
        setFindOpen(true)
        return
      }
      if (typing) return
      // Actions grille (uniquement quand pas dans une saisie)
      if (e.key === 'F2' && selectedCell) {
        e.preventDefault()
        handleCellDoubleClick(selectedCell)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCell) {
        e.preventDefault()
        updateCell(selectedCell, '')
        return
      }
      if (selectedCell) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          moveSelection(-1, 0)
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          moveSelection(1, 0)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          moveSelection(0, -1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          moveSelection(0, 1)
        } else if (e.key === 'Home') {
          e.preventDefault()
          const ref = parseCellRef(selectedCell)
          if (ref) setSelectedCell(cellKey(ref.row, 0))
        } else if (e.key === 'End') {
          e.preventDefault()
          const ref = parseCellRef(selectedCell)
          if (ref) setSelectedCell(cellKey(ref.row, sheet.colCount - 1))
        } else if (e.key === 'Enter') {
          e.preventDefault()
          handleCellDoubleClick(selectedCell)
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          // Saisie directe : ouvre l'édition en écrasant la valeur (parité Excel).
          setEditingCell(selectedCell)
          setEditValue(e.key)
          setTimeout(() => cellInputRef.current?.focus(), 0)
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleSave, undoSheet, redoSheet, selectedCell, moveSelection, updateCell, sheet.colCount])

  const handleImportXlsx = useCallback(
    async (file: File) => {
      try {
        const imported = await importXlsx(file)
        resetSheet(imported)
        toast.success('XLSX importé')
      } catch (e) {
        console.error(e)
        toast.error("Erreur lors de l'import XLSX")
      }
    },
    [resetSheet]
  )

  const selectedCellData = selectedCell ? sheet.data[selectedCell] : null

  return (
    <div className={cn('flex flex-col editor-shell h-full overflow-hidden', className)}>
      <EditorHeader
        documentName={documentName}
        kind="Tableur"
        isSaving={isSaving}
        lastSaved={lastSaved}
        presence={coeditUsers}
        isCollabConnected={isCoeditConnected}
      >
        <EditorAIButton onClick={() => setAiOpen(true)} title="Générer une formule avec l'IA">
          Formule IA
        </EditorAIButton>
        <EditorAIButton onClick={() => setCopilotOpen(true)} title="Ouvrir le Copilot (chat IA)">
          Copilot
        </EditorAIButton>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFindOpen(true)}
          className="gap-1.5 h-8 text-xs"
        >
          <Search className="h-3.5 w-3.5" /> Rechercher
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setChartOpen(true)}
          className="gap-1.5 h-8 text-xs"
        >
          <BarChart3 className="h-3.5 w-3.5" /> Graphique
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCfOpen(true)}
          className="gap-1.5 h-8 text-xs"
        >
          <Palette className="h-3.5 w-3.5" /> Format cond.
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => importInputRef.current?.click()}
          className="gap-1.5 h-8 text-xs"
        >
          <FileUp className="h-3.5 w-3.5" /> Import XLSX
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="gap-1.5 h-8 text-xs"
        >
          <Save className="h-3.5 w-3.5" /> Enregistrer
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHistoryOpen(true)}
          className="gap-1.5 h-8 text-xs"
          title="Historique des versions"
        >
          <History className="h-3.5 w-3.5" /> Historique
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportXlsx}
          className="gap-1.5 h-8 text-xs"
        >
          <FileDown className="h-3.5 w-3.5" /> XLSX
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExportPdf} className="gap-1.5 h-8 text-xs">
          <FileDown className="h-3.5 w-3.5" /> PDF
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExportCsv} className="gap-1.5 h-8 text-xs">
          <FileDown className="h-3.5 w-3.5" /> CSV
        </Button>
        {onClose && <EditorCloseButton onClose={onClose} />}
      </EditorHeader>

      {/* Formula bar */}
      <div className="editor-formula-bar flex items-center gap-2 px-3 py-1.5">
        <span className="text-xs font-mono font-semibold text-muted-foreground w-10 text-center">
          {selectedCell || ''}
        </span>
        <span className="editor-fx-badge inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px]">
          fx
        </span>
        <Input
          ref={formulaBarRef}
          className="h-8 text-xs font-mono bg-background/70 focus-visible:ring-primary/40"
          value={
            editingCell === selectedCell
              ? editValue
              : selectedCellData?.formula || selectedCellData?.value || ''
          }
          onChange={(e) => {
            if (selectedCell) {
              setEditingCell(selectedCell)
              setEditValue(e.target.value)
            }
          }}
          onKeyDown={handleCellKeyDown}
          placeholder="Entrez une valeur ou une formule (=SUM(A1:A10))"
        />
      </div>

      {/* Spreadsheet grid */}
      <div className="flex-1 overflow-auto editor-shell">
        <table className="border-collapse w-max min-w-full select-none">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-10 min-w-[40px] h-7 editor-grid-header-cell border text-[10px] font-semibold sticky left-0 z-20" />
              {Array.from({ length: sheet.colCount }, (_, c) => (
                <th
                  key={c}
                  className={cn(
                    'h-7 editor-grid-header-cell border text-[10px] font-semibold px-1',
                    selectedCell &&
                      parseCellRef(selectedCell)?.col === c &&
                      'bg-primary/15 text-primary'
                  )}
                  style={{ width: sheet.colWidths[c] || DEFAULT_COL_WIDTH, minWidth: 50 }}
                >
                  {colLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.rowCount }, (_, r) => (
              <tr key={r}>
                <td
                  className={cn(
                    'h-7 editor-grid-header-cell border text-[10px] font-semibold text-center sticky left-0 z-10 w-10',
                    selectedCell &&
                      parseCellRef(selectedCell)?.row === r &&
                      'bg-primary/15 text-primary'
                  )}
                >
                  {r + 1}
                </td>
                {Array.from({ length: sheet.colCount }, (_, c) => {
                  const key = cellKey(r, c)
                  const isSelected = selectedCell === key
                  const isEditing = editingCell === key
                  const displayValue = getCellDisplay(key)
                  const cellFmt = sheet.data[key]?.format
                  const cfRule = cfRules.find((rule) => evaluateCfRule(rule, key, displayValue))

                  return (
                    <td
                      key={c}
                      className={cn(
                        'h-7 editor-grid-cell border px-1 text-xs cursor-cell relative',
                        isSelected &&
                          'outline outline-2 outline-primary outline-offset-[-1px] bg-primary/5',
                        (cellFmt?.bold || cfRule?.bold) && 'font-bold',
                        cellFmt?.italic && 'italic'
                      )}
                      style={{
                        textAlign: cellFmt?.align || 'left',
                        backgroundColor: cfRule?.bgColor || cellFmt?.bgColor,
                        color: cfRule?.textColor || cellFmt?.textColor,
                      }}
                      onClick={() => {
                        if (editingCell && editingCell !== key) commitEdit()
                        setSelectedCell(key)
                      }}
                      onDoubleClick={() => handleCellDoubleClick(key)}
                    >
                      {isEditing ? (
                        <input
                          ref={cellInputRef}
                          className="absolute inset-0 w-full h-full px-1 text-xs border-0 outline-none bg-background z-10"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleCellKeyDown}
                          onBlur={commitEdit}
                        />
                      ) : (
                        <span className="truncate block">{displayValue}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormulaAssistantDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        documentId={documentId ?? null}
        headers={aiHeaders}
        sampleRows={aiSample}
        currentFormula={
          selectedCell
            ? sheet.data[selectedCell]?.formula || sheet.data[selectedCell]?.value || ''
            : ''
        }
        onApplyFormula={(formula) => {
          if (!selectedCell) {
            toast.info('Sélectionnez une cellule cible pour insérer la formule')
            return
          }
          updateCell(selectedCell, formula)
        }}
      />

      <CopilotSidePanel
        open={copilotOpen}
        onOpenChange={setCopilotOpen}
        documentTitle={documentName}
        documentHtml={`Colonnes: ${aiHeaders.join(' | ')}\n\nÉchantillon:\n${aiSample
          .slice(0, 20)
          .map((r) => r.join(' | '))
          .join('\n')}${
          selectedCell
            ? `\n\nCellule sélectionnée: ${selectedCell} = ${
                sheet.data[selectedCell]?.formula || sheet.data[selectedCell]?.value || '(vide)'
              }`
            : ''
        }`}
        documentId={documentId ?? null}
        onInsertAtCursor={(html: string) => {
          if (!selectedCell) {
            toast.info("Sélectionnez une cellule cible avant d'insérer")
            return
          }
          const tmp = document.createElement('div')
          tmp.innerHTML = html
          const text = (tmp.textContent || '').trim()
          if (!text) return
          updateCell(selectedCell, text)
          toast.success(`Inséré dans ${selectedCell}`)
        }}
      />

      <ChartInsertDialog
        open={chartOpen}
        onOpenChange={setChartOpen}
        getCellValue={getCellDisplay}
        onInsert={(spec, svg) => {
          setCharts((prev) => [...prev, { id: crypto.randomUUID(), svg, title: spec.title }])
          toast.success('Graphique inséré')
        }}
      />

      <ConditionalFormattingDialog
        open={cfOpen}
        onOpenChange={setCfOpen}
        rules={cfRules}
        onChange={setCfRules}
      />

      <VersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        documentId={documentId}
        documentName={documentName}
        kind="json"
        getCurrentContent={() => JSON.stringify(sheet)}
        onRestore={(content) => {
          try {
            const parsed = JSON.parse(content) as typeof sheet
            resetSheet(parsed)
          } catch (err) {
            console.error('Restore spreadsheet version failed', err)
            toast.error('Impossible de restaurer cette version')
          }
        }}
      />

      {/* Find & Replace (recherche simple sur les valeurs affichées) */}
      {findOpen && (
        <SpreadsheetFindReplace
          sheet={sheet}
          getCellDisplay={getCellDisplay}
          onGoto={(k) => setSelectedCell(k)}
          onReplace={(k, v) => updateCell(k, v)}
          onClose={() => setFindOpen(false)}
        />
      )}

      {charts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 w-[420px] max-h-[70vh] overflow-auto bg-card text-card-foreground rounded-lg shadow-xl border border-border">
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 text-xs font-medium">
            Graphiques ({charts.length})
            <button
              onClick={() => setCharts([])}
              className="text-muted-foreground hover:text-red-500"
            >
              ×
            </button>
          </div>
          {charts.map((c) => (
            <div
              key={c.id}
              className="p-2 border-b last:border-b-0"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.svg, SVG_SANITIZE_CONFIG) }}
            />
          ))}
        </div>
      )}

      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImportXlsx(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// Mini panneau Find/Replace intégré au tableur (léger, non-modal)
function SpreadsheetFindReplace({
  sheet,
  getCellDisplay,
  onGoto,
  onReplace,
  onClose,
}: {
  sheet: { data: Record<string, { value?: string; formula?: string }> }
  getCellDisplay: (k: string) => string
  onGoto: (k: string) => void
  onReplace: (k: string, v: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [repl, setRepl] = useState('')
  const matches = useMemo(() => {
    if (!q) return []
    const lq = q.toLowerCase()
    return Object.entries(sheet.data)
      .filter(([k]) => {
        const v = getCellDisplay(k)
        return v.toLowerCase().includes(lq)
      })
      .map(([k]) => k)
  }, [q, sheet.data, getCellDisplay])

  return (
    <div className="fixed top-16 right-4 z-50 w-80 bg-card text-card-foreground border border-border rounded-lg shadow-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Rechercher</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-red-500 text-xs">
          ×
        </button>
      </div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Texte à trouver…"
        autoFocus
        className="h-8 text-xs"
      />
      <Input
        value={repl}
        onChange={(e) => setRepl(e.target.value)}
        placeholder="Remplacer par…"
        className="h-8 text-xs"
      />
      <div className="text-[11px] text-muted-foreground">{matches.length} occurrence(s)</div>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          onClick={() => matches[0] && onGoto(matches[0])}
          disabled={matches.length === 0}
        >
          Aller
        </Button>
        <Button
          size="sm"
          className="flex-1 text-xs"
          disabled={matches.length === 0}
          onClick={() => {
            matches.forEach((k) => {
              const v = getCellDisplay(k).replace(
                new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                repl
              )
              onReplace(k, v)
            })
            toast.success(`${matches.length} cellule(s) mise(s) à jour`)
          }}
        >
          Tout remplacer
        </Button>
      </div>
    </div>
  )
}
