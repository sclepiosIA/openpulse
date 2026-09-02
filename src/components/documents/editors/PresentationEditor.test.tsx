import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  saveMock,
  toastSuccess,
  toastError,
  loadPdfLibsMock,
  pptxWriteFileMock,
  addSlideMock,
  jsPdfCtorMock,
  jsPdfInstance,
  promptMock,
  PptxGenJSMock,
} = vi.hoisted(() => {
  const toastSuccessInner = vi.fn()
  const toastErrorInner = vi.fn()

  const saveMockInner = vi.fn<[(blob: Blob) => Promise<void>], Promise<void>>()
  saveMockInner.mockImplementation(async () => undefined)

  const pptxWriteFileMockInner = vi.fn<[{ fileName: string }], Promise<void>>().mockResolvedValue(undefined)

  const addTextMock = vi.fn()
  const addImageMock = vi.fn()
  const addShapeMock = vi.fn()

  const addSlideMockInner = vi.fn(() => ({
    background: undefined as unknown,
    addText: addTextMock,
    addImage: addImageMock,
    addShape: addShapeMock,
  }))

  class PptxGenJSMockInner {
    layout: string | undefined
    addSlide = addSlideMockInner
    writeFile = pptxWriteFileMockInner
  }

  const jsPdfInstanceInner = {
    addPage: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn(),
    roundedRect: vi.fn(),
    addImage: vi.fn(),
    save: vi.fn(),
  }

  const jsPdfCtorMockInner = vi.fn(() => jsPdfInstanceInner)

  const loadPdfLibsMockInner = vi.fn(async () => ({
    jsPDF: jsPdfCtorMockInner,
  }))

  const promptMockInner = vi.fn<string | null, [message?: string]>()

  return {
    saveMock: saveMockInner,
    toastSuccess: toastSuccessInner,
    toastError: toastErrorInner,
    loadPdfLibsMock: loadPdfLibsMockInner,
    pptxWriteFileMock: pptxWriteFileMockInner,
    addSlideMock: addSlideMockInner,
    jsPdfCtorMock: jsPdfCtorMockInner,
    jsPdfInstance: jsPdfInstanceInner,
    promptMock: promptMockInner,
    PptxGenJSMock: PptxGenJSMockInner,
  }
})

vi.mock('@/hooks/documents/useRealtimeCoedit', () => ({
  useRealtimeCoedit: () => ({
    connectedUsers: [],
    isConnected: false,
  }),
}))

vi.mock('@/hooks/documents/useNativeDocumentSave', () => ({
  useNativeDocumentSave: () => ({
    save: saveMock,
    isSaving: false,
  }),
}))

vi.mock('@/lib/export/dynamicPdfImport', () => ({
  loadPdfLibs: loadPdfLibsMock,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    ...rest
  }: {
    children?: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-icon="" {...props} />
  return {
    ...actual,
    Plus: Icon,
    Trash2: Icon,
    Save: Icon,
    FileDown: Icon,
    Play: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Loader2: Icon,
    Type: Icon,
    Image: Icon,
    Square: Icon,
    PresentationIcon: Icon,
    History: Icon,
  }
})

vi.mock('pptxgenjs', () => ({
  default: PptxGenJSMock,
}))

const buildQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = buildQueryClient()
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(ui, { wrapper: Wrapper })
}

const ensureCryptoUUID = () => {
  if (!globalThis.crypto) {
    ;(globalThis as unknown as { crypto?: Crypto }).crypto = {} as Crypto
  }
  if (!globalThis.crypto.randomUUID) {
    let i = 0
    ;(globalThis.crypto as unknown as { randomUUID: () => string }).randomUUID = () => `uuid-${++i}`
  }
}

describe('PresentationEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureCryptoUUID()
    vi.spyOn(window, 'prompt').mockImplementation(promptMock)
  })

  it('affiche le documentName, initialise 2 slides et sauvegarde (succès)', async () => {
    const { PresentationEditor } = await import('./PresentationEditor')
    renderWithClient(<PresentationEditor documentName="Ma présentation" />)

    expect(screen.getByText('Ma présentation')).toBeTruthy()

    const saveBtn = screen.getByRole('button', { name: /Enregistrer/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    expect(saveMock).toHaveBeenCalledTimes(1)
    const arg = saveMock.mock.calls[0]?.[0]
    expect(arg).toBeInstanceOf(Blob)
    expect(toastSuccess).toHaveBeenCalledWith('Présentation enregistrée')
    expect(toastError).not.toHaveBeenCalled()
  })

  it("gère l'erreur de sauvegarde (toast.error)", async () => {
    saveMock.mockRejectedValueOnce(new Error('save-failed'))

    const { PresentationEditor } = await import('./PresentationEditor')
    renderWithClient(<PresentationEditor documentName="Deck" />)

    const saveBtn = screen.getByRole('button', { name: /Enregistrer/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la sauvegarde')
  })

  it('exporte PPTX (succès), crée une slide par slide et appelle writeFile avec nom sans extension', async () => {
    const { PresentationEditor } = await import('./PresentationEditor')
    renderWithClient(<PresentationEditor documentName="Cours.json" />)

    const btn = screen.getByRole('button', { name: /PPTX/i })
    await act(async () => {
      fireEvent.click(btn)
    })

    expect(addSlideMock).toHaveBeenCalledTimes(2)
    expect(pptxWriteFileMock).toHaveBeenCalledTimes(1)
    expect(pptxWriteFileMock).toHaveBeenCalledWith({ fileName: 'Cours.pptx' })
    expect(toastSuccess).toHaveBeenCalledWith('PPTX exporté avec succès')
    expect(toastError).not.toHaveBeenCalled()
  })

  it("gère l'erreur d'export PPTX (toast.error)", async () => {
    pptxWriteFileMock.mockRejectedValueOnce(new Error('pptx-failed'))

    const { PresentationEditor } = await import('./PresentationEditor')
    renderWithClient(<PresentationEditor documentName="Cours" />)

    const btn = screen.getByRole('button', { name: /PPTX/i })
    await act(async () => {
      fireEvent.click(btn)
    })

    expect(pptxWriteFileMock).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith("Erreur lors de l'export PPTX")
  })

  it('exporte PDF (succès) via loadPdfLibs et jsPDF.save avec nom sans extension', async () => {
    const { PresentationEditor } = await import('./PresentationEditor')
    renderWithClient(<PresentationEditor documentName="Deck.pptx" />)

    const btn = screen.getByRole('button', { name: /PDF/i })
    await act(async () => {
      fireEvent.click(btn)
    })

    expect(loadPdfLibsMock).toHaveBeenCalledTimes(1)
    expect(jsPdfCtorMock).toHaveBeenCalledTimes(1)
    expect(jsPdfInstance.save).toHaveBeenCalledWith('Deck.pdf')
    expect(toastSuccess).toHaveBeenCalledWith('PDF exporté avec succès')
    expect(toastError).not.toHaveBeenCalled()
  })

  it("gère l'erreur d'export PDF (toast.error)", async () => {
    loadPdfLibsMock.mockRejectedValueOnce(new Error('pdf-libs-failed'))

    const { PresentationEditor } = await import('./PresentationEditor')
    renderWithClient(<PresentationEditor documentName="Deck" />)

    const btn = screen.getByRole('button', { name: /PDF/i })
    await act(async () => {
      fireEvent.click(btn)
    })

    expect(loadPdfLibsMock).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith("Erreur lors de l'export PDF")
  })
})