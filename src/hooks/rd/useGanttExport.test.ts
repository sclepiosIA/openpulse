import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RefObject, createElement } from 'react'
import { useGanttExport } from './useGanttExport'

const {
  html2canvas,
  loadHtml2Canvas,
  jsPDFConstructor,
  loadPdfLibs,
  toast,
  debug,
  generateGanttExportHeaderHTML,
  generateGanttExportLegendHTML,
  generateGanttExportFooterHTML,
  isBefore
} = vi.hoisted(() => {
  const html2canvas = vi.fn()
  const loadHtml2Canvas = vi.fn(async () => ({ html2canvas }))

  const jsPDFConstructor = vi.fn(function JsPDFMock(this: any) {
    this.internal = {
      pageSize: {
        getWidth: () => 420,
        getHeight: () => 297
      }
    }
    this.addPage = vi.fn()
    this.addImage = vi.fn()
    this.setFontSize = vi.fn()
    this.setTextColor = vi.fn()
    this.text = vi.fn()
    this.save = vi.fn()
  })
  const loadPdfLibs = vi.fn(async () => ({ jsPDF: jsPDFConstructor }))

  const toast = {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  }
  const debug = {
    error: vi.fn(),
    warn: vi.fn()
  }

  const generateGanttExportHeaderHTML = vi.fn(() => '<div data-test="header">HEADER</div>')
  const generateGanttExportLegendHTML = vi.fn(() => '<div data-test="legend">LEGEND</div>')
  const generateGanttExportFooterHTML = vi.fn(() => '<div data-test="footer">FOOTER</div>')

  const isBefore = vi.fn((dateLeft: Date, dateRight: Date) => dateLeft.getTime() < dateRight.getTime())

  return {
    html2canvas,
    loadHtml2Canvas,
    jsPDFConstructor,
    loadPdfLibs,
    toast,
    debug,
    generateGanttExportHeaderHTML,
    generateGanttExportLegendHTML,
    generateGanttExportFooterHTML,
    isBefore
  }
})

vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/debug', () => ({ debug }))
vi.mock('@/components/etablissement-gantt/export/GanttExportHeader', () => ({ generateGanttExportHeaderHTML }))
vi.mock('@/components/etablissement-gantt/export/GanttExportLegend', () => ({ generateGanttExportLegendHTML }))
vi.mock('@/components/etablissement-gantt/export/GanttExportFooter', () => ({ generateGanttExportFooterHTML }))
vi.mock('@/lib/export/dynamicPdfImport', () => ({
  loadPdfLibs,
  loadHtml2Canvas
}))
vi.mock('date-fns', () => ({ isBefore }))

const createWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  })
  const Wrapper = ({ children }: { children?: unknown }) => {
    return createElement(QueryClientProvider, { client: qc }, children)
  }
  return Wrapper
}

describe('useGanttExport', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL
  let originalRevokeObjectURL: typeof URL.revokeObjectURL
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn((blob: Blob) => 'blob:url')
    URL.revokeObjectURL = vi.fn()
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    clickSpy.mockRestore()
    document.body.innerHTML = ''
  })

  it('exportToPNG — successful flow creates blob, triggers download and toasts', async () => {
    html2canvas.mockImplementation(async (el: HTMLElement, opts: any) => {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      // @ts-ignore intentional override for test
      canvas.toBlob = (cb: (b: Blob | null) => void, type?: string) => {
        cb(new Blob(['x'], { type: 'image/png' }))
      }
      return canvas
    })

    const container = document.createElement('div')
    container.innerHTML = '<div class="task truncate overflow-auto max-h-20">Task</div><img src="/local-image.png" />'
    document.body.appendChild(container)
    const containerRef: RefObject<HTMLElement> = { current: container } as RefObject<HTMLElement>

    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    const context = {
      etablissementNom: 'Test Etab',
      tasks: [
        { statut: 'A faire', date_echeance: pastDate },
        { statut: 'Terminé', date_echeance: pastDate },
        { statut: 'En cours', date_echeance: null }
      ],
      categories: [{ id: 'c1', nom: 'Cat1', couleur: '#fff' }],
      timeline: { start: new Date(), end: new Date() }
    }

    const { result } = renderHook(() => useGanttExport(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.exportToPNG(containerRef, context, 'planning.png')
    })

    expect(toast.info).toHaveBeenCalled()
    const infoCall0 = (toast.info as unknown as vi.Mock).mock.calls[0][0] as string
    expect(infoCall0).toContain("Génération de l'image en cours")

    expect(URL.createObjectURL).toHaveBeenCalled()
    const passedBlob = (URL.createObjectURL as unknown as vi.Mock).mock.calls[0][0] as Blob
    expect(passedBlob).toBeInstanceOf(Blob)

    expect(clickSpy).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url')

    expect(toast.success).toHaveBeenCalledWith('Export PNG réussi', { id: 'export-png' })

    const remaining = Array.from(document.body.children).find((c) =>
      c instanceof HTMLElement && c.style && c.style.zIndex === '-9999'
    )
    expect(remaining).toBeUndefined()
  })

  it('exportToPNG — handles canvas.toBlob returning null and triggers error toast and debug', async () => {
    html2canvas.mockImplementation(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 100
      // @ts-ignore
      canvas.toBlob = (cb: (b: Blob | null) => void, type?: string) => {
        cb(null)
      }
      return canvas
    })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const containerRef: RefObject<HTMLElement> = { current: container } as RefObject<HTMLElement>

    const context = {
      etablissementNom: 'E',
      tasks: [] as { statut?: string | null; date_echeance?: string | null }[],
      categories: [] as { id: string; nom: string; couleur?: string | null }[],
      timeline: { start: new Date(), end: new Date() }
    }

    const { result } = renderHook(() => useGanttExport(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.exportToPNG(containerRef, context, 'err.png')
    })

    expect(debug.error).toHaveBeenCalled()
    const debugArg0 = (debug.error as unknown as vi.Mock).mock.calls[0][0] as string
    expect(debugArg0).toContain('Erreur export PNG')

    const errCall = (toast.error as unknown as vi.Mock).mock.calls.find((c: unknown[]) => {
      return typeof c[0] === 'string' && (c[0] as string).includes("Impossible de créer l'image PNG")
    })
    expect(errCall).toBeDefined()

    expect(toast.success).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('exportToPDF — successful flow uses jsPDF and saves file and triggers success toast', async () => {
    html2canvas.mockImplementation(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1000
      canvas.height = 1200
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'red'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      // @ts-ignore
      canvas.toBlob = (cb: (b: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/png' }))
      return canvas
    })

    jsPDFConstructor.mockClear()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const containerRef: RefObject<HTMLElement> = { current: container } as RefObject<HTMLElement>

    const context = {
      etablissementNom: 'PDF E',
      tasks: [{ statut: 'En cours', date_echeance: null }],
      categories: [{ id: 'c1', nom: 'Cat', couleur: null }],
      timeline: { start: new Date(), end: new Date() }
    }

    const { result } = renderHook(() => useGanttExport(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.exportToPDF(containerRef, context, 'report.pdf')
    })

    expect(jsPDFConstructor).toHaveBeenCalled()
    const instance = (jsPDFConstructor as unknown as vi.Mock).mock.instances[0]
    expect(instance.save).toHaveBeenCalledWith('report.pdf')

    expect(toast.success).toHaveBeenCalledWith('Export PDF réussi', { id: 'export-pdf' })
  })

  it('exportToPDF — handles loadPdfLibs throwing and triggers error toast and debug', async () => {
    html2canvas.mockImplementation(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 200
      // @ts-ignore
      canvas.toBlob = (cb: (b: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/png' }))
      return canvas
    })

    loadPdfLibs.mockImplementationOnce(async () => {
      throw new Error('lib load failed')
    })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const containerRef: RefObject<HTMLElement> = { current: container } as RefObject<HTMLElement>

    const context = {
      etablissementNom: 'ErrPDF',
      tasks: [] as { statut?: string | null; date_echeance?: string | null }[],
      categories: [] as { id: string; nom: string; couleur?: string | null }[],
      timeline: { start: new Date(), end: new Date() }
    }

    const { result } = renderHook(() => useGanttExport(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.exportToPDF(containerRef, context, 'fail.pdf')
    })

    expect(debug.error).toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith("Impossible d'exporter le Gantt en PDF", { id: 'export-pdf' })
  })
})