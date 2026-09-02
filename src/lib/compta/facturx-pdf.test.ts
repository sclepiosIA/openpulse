const {
  SAVED_BYTES,
  drawTextCalls,
  drawLineCalls,
  fakePdf,
  fakePage,
  mockCreate,
  mockAddPage,
  mockEmbedFont,
  mockAttach,
  mockSave,
  mockSetTitle,
  mockSetAuthor,
  mockSetSubject,
  mockSetKeywords,
  mockSetProducer,
  mockSetCreator,
  mockRgb,
} = vi.hoisted(() => {
  type TextOptions = {
    x: number
    y: number
    size: number
    font: string
    color: { r: number; g: number; b: number }
  }

  type LineOptions = {
    start: { x: number; y: number }
    end: { x: number; y: number }
    thickness: number
  }

  const drawTextCalls: Array<{ text: string; options: TextOptions }> = []
  const drawLineCalls: Array<LineOptions> = []
  const SAVED_BYTES = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10])

  const mockRgb = vi.fn((r: number, g: number, b: number) => ({ r, g, b }))

  const mockDrawText = vi.fn((text: string, options: TextOptions) => {
    drawTextCalls.push({ text, options })
  })

  const mockDrawLine = vi.fn((options: LineOptions) => {
    drawLineCalls.push(options)
  })

  const fakePage = {
    drawText: mockDrawText,
    drawLine: mockDrawLine,
  }

  const mockAddPage = vi.fn(() => fakePage)
  const mockEmbedFont = vi.fn((fontName: string) => Promise.resolve(fontName))
  const mockAttach = vi.fn(() => Promise.resolve())
  const mockSave = vi.fn(() => Promise.resolve(SAVED_BYTES))
  const mockSetTitle = vi.fn()
  const mockSetAuthor = vi.fn()
  const mockSetSubject = vi.fn()
  const mockSetKeywords = vi.fn()
  const mockSetProducer = vi.fn()
  const mockSetCreator = vi.fn()

  const fakePdf = {
    addPage: mockAddPage,
    embedFont: mockEmbedFont,
    attach: mockAttach,
    save: mockSave,
    setTitle: mockSetTitle,
    setAuthor: mockSetAuthor,
    setSubject: mockSetSubject,
    setKeywords: mockSetKeywords,
    setProducer: mockSetProducer,
    setCreator: mockSetCreator,
  }

  const mockCreate = vi.fn(() => Promise.resolve(fakePdf))

  return {
    SAVED_BYTES,
    drawTextCalls,
    drawLineCalls,
    fakePdf,
    fakePage,
    mockCreate,
    mockAddPage,
    mockEmbedFont,
    mockAttach,
    mockSave,
    mockSetTitle,
    mockSetAuthor,
    mockSetSubject,
    mockSetKeywords,
    mockSetProducer,
    mockSetCreator,
    mockRgb,
  }
})

vi.mock('pdf-lib', () => ({
  PDFDocument: { create: mockCreate },
  StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'HelveticaBold' },
  AFRelationship: { Alternative: 'Alternative' },
  rgb: mockRgb,
}))

import { AFRelationship } from 'pdf-lib'
import { downloadBlob, generateFacturXPdf, type FacturXInput } from './facturx-pdf'

const eur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)

const readBlobBytes = (blob: Blob): Promise<number[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => {
      reject(reader.error ?? new Error('lecture du Blob impossible'))
    }

    reader.onload = () => {
      const result = reader.result
      if (result instanceof ArrayBuffer) {
        resolve(Array.from(new Uint8Array(result)))
        return
      }

      reject(new Error('résultat de lecture Blob invalide'))
    }

    reader.readAsArrayBuffer(blob)
  })

const buildInput = (): FacturXInput => ({
  numero: 'F-24-01',
  date: '2024-04-30',
  emetteur: {
    nom: 'Cabinet Sante',
    siren: '123456789',
    adresse: '10 rue des Lilas, Paris',
  },
  client: {
    nom: 'Clinique Demo',
    siret: '98765432100012',
    adresse: '2 avenue Test, Lyon',
  },
  lignes: [
    {
      description: 'Accompagnement migration applicative prioritaire avec atelier',
      quantite: 2,
      prix_unitaire: 99.9,
      tva_taux: 20,
    },
    {
      description: 'Forfait support',
      quantite: 1,
      prix_unitaire: 34.7,
      tva_taux: 5.5,
    },
  ],
  total_ht: 234.5,
  total_tva: 48.12,
  total_ttc: 282.62,
  xml_cii: '<rsm:CrossIndustryInvoice><ram:ID>F-24-01</ram:ID></rsm:CrossIndustryInvoice>',
  profile: 'EN 16931',
})

beforeEach(() => {
  drawTextCalls.length = 0
  drawLineCalls.length = 0
  vi.clearAllMocks()
  mockCreate.mockImplementation(() => Promise.resolve(fakePdf))
  mockAddPage.mockImplementation(() => fakePage)
  mockEmbedFont.mockImplementation((fontName: string) => Promise.resolve(fontName))
  mockAttach.mockImplementation(() => Promise.resolve())
  mockSave.mockImplementation(() => Promise.resolve(SAVED_BYTES))
})

describe('generateFacturXPdf', () => {
  it('génère un Blob PDF avec les données métier de facture, les métadonnées et le XML Factur-X attaché', async () => {
    const input = buildInput()

    const blob = await generateFacturXPdf(input)

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBe(SAVED_BYTES.byteLength)
    await expect(readBlobBytes(blob)).resolves.toEqual(Array.from(SAVED_BYTES))

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockAddPage).toHaveBeenCalledWith([595, 842])
    expect(mockEmbedFont).toHaveBeenNthCalledWith(1, 'Helvetica')
    expect(mockEmbedFont).toHaveBeenNthCalledWith(2, 'HelveticaBold')
    expect(mockRgb).toHaveBeenCalledWith(0, 0, 0)

    expect(drawTextCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'FACTURE F-24-01',
          options: expect.objectContaining({ x: 40, y: 800, size: 18, font: 'HelveticaBold' }),
        }),
        expect.objectContaining({
          text: 'Date : 2024-04-30',
          options: expect.objectContaining({ x: 40, y: 776, size: 10, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: 'Émetteur',
          options: expect.objectContaining({ x: 40, y: 746, size: 11, font: 'HelveticaBold' }),
        }),
        expect.objectContaining({
          text: 'Client',
          options: expect.objectContaining({ x: 320, y: 746, size: 11, font: 'HelveticaBold' }),
        }),
        expect.objectContaining({
          text: 'Cabinet Sante',
          options: expect.objectContaining({ x: 40, y: 730, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: 'SIREN 123456789',
          options: expect.objectContaining({ x: 40, y: 718, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: '10 rue des Lilas, Paris',
          options: expect.objectContaining({ x: 40, y: 706, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: 'Clinique Demo',
          options: expect.objectContaining({ x: 320, y: 730, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: 'SIRET 98765432100012',
          options: expect.objectContaining({ x: 320, y: 718, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: '2 avenue Test, Lyon',
          options: expect.objectContaining({ x: 320, y: 706, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: 'Description',
          options: expect.objectContaining({ x: 40, y: 674, size: 10, font: 'HelveticaBold' }),
        }),
        expect.objectContaining({
          text: 'Qté',
          options: expect.objectContaining({ x: 320, y: 674, size: 10, font: 'HelveticaBold' }),
        }),
        expect.objectContaining({
          text: 'PU HT',
          options: expect.objectContaining({ x: 370, y: 674, size: 10, font: 'HelveticaBold' }),
        }),
        expect.objectContaining({
          text: 'TVA',
          options: expect.objectContaining({ x: 440, y: 674, size: 10, font: 'HelveticaBold' }),
        }),
        expect.objectContaining({
          text: 'Total HT',
          options: expect.objectContaining({ x: 490, y: 674, size: 10, font: 'HelveticaBold' }),
        }),
        expect.objectContaining({
          text: input.lignes[0].description.slice(0, 45),
          options: expect.objectContaining({ x: 40, y: 656, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: '2',
          options: expect.objectContaining({ x: 320, y: 656, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: eur(99.9),
          options: expect.objectContaining({ x: 370, y: 656, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: '20%',
          options: expect.objectContaining({ x: 440, y: 656, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: eur(199.8),
          options: expect.objectContaining({ x: 490, y: 656, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: 'Forfait support',
          options: expect.objectContaining({ x: 40, y: 642, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: eur(34.7),
          options: expect.objectContaining({ x: 370, y: 642, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: '5.5%',
          options: expect.objectContaining({ x: 440, y: 642, size: 9, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: eur(234.5),
          options: expect.objectContaining({ x: 490, y: 588, size: 10, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: eur(48.12),
          options: expect.objectContaining({ x: 490, y: 574, size: 10, font: 'Helvetica' }),
        }),
        expect.objectContaining({
          text: eur(282.62),
          options: expect.objectContaining({ x: 490, y: 560, size: 11, font: 'HelveticaBold' }),
        }),
      ])
    )

    expect(drawLineCalls).toEqual([
      { start: { x: 40, y: 668 }, end: { x: 555, y: 668 }, thickness: 0.5 },
      { start: { x: 40, y: 608 }, end: { x: 555, y: 608 }, thickness: 0.5 },
    ])

    expect(mockSetTitle).toHaveBeenCalledWith('Facture F-24-01')
    expect(mockSetAuthor).toHaveBeenCalledWith('Cabinet Sante')
    expect(mockSetSubject).toHaveBeenCalledWith('Facture électronique Factur-X')
    expect(mockSetKeywords).toHaveBeenCalledWith(['facture', 'factur-x', 'e-invoice'])
    expect(mockSetProducer).toHaveBeenCalledWith('OpenPulse - Factur-X')
    expect(mockSetCreator).toHaveBeenCalledWith('OpenPulse')

    expect(mockAttach).toHaveBeenCalledTimes(1)
    const attachCall = mockAttach.mock.calls.at(0)
    if (attachCall === undefined) {
      throw new Error('appel attach manquant')
    }

    const [xmlBytes, filename, attachOptions] = attachCall
    expect(xmlBytes).toEqual(new TextEncoder().encode(input.xml_cii))
    expect(filename).toBe('factur-x.xml')

    const typedOptions = attachOptions as {
      mimeType?: unknown
      description?: unknown
      creationDate?: unknown
      modificationDate?: unknown
      afRelationship?: unknown
    }

    expect(typedOptions.mimeType).toBe('application/xml')
    expect(typedOptions.description).toBe('Factur-X XML CII')
    expect(typedOptions.creationDate).toBeInstanceOf(Date)
    expect(typedOptions.modificationDate).toBeInstanceOf(Date)
    expect(typedOptions.afRelationship).toBe(AFRelationship.Alternative)
    expect(mockSave).toHaveBeenCalledTimes(1)
  })

  it('ignore les champs optionnels absents sans dessiner de lignes SIREN, SIRET ou adresse vides', async () => {
    const input: FacturXInput = {
      ...buildInput(),
      emetteur: { nom: 'Independant' },
      client: { nom: 'Client Simple' },
      lignes: [],
      total_ht: 0,
      total_tva: 0,
      total_ttc: 0,
    }

    const blob = await generateFacturXPdf(input)

    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBe(SAVED_BYTES.byteLength)

    const renderedTexts = drawTextCalls.map((call) => call.text)
    expect(renderedTexts).toContain('Independant')
    expect(renderedTexts).toContain('Client Simple')
    expect(renderedTexts).not.toContain('SIREN ')
    expect(renderedTexts).not.toContain('SIRET ')
    expect(renderedTexts).toContain(eur(0))
    expect(drawLineCalls).toEqual([
      { start: { x: 40, y: 692 }, end: { x: 555, y: 692 }, thickness: 0.5 },
      { start: { x: 40, y: 660 }, end: { x: 555, y: 660 }, thickness: 0.5 },
    ])
    expect(mockSetAuthor).toHaveBeenCalledWith('Independant')
    expect(mockSetTitle).toHaveBeenCalledWith('Facture F-24-01')
  })

  it('arrête les lignes de facture quand la zone basse de page est atteinte', async () => {
    const lignes = Array.from({ length: 50 }, (_, index) => ({
      description: `Ligne facture ${index + 1}`,
      quantite: 1,
      prix_unitaire: 10,
      tva_taux: 20,
    }))
    const input: FacturXInput = {
      ...buildInput(),
      lignes,
      total_ht: 500,
      total_tva: 100,
      total_ttc: 600,
    }

    await generateFacturXPdf(input)

    const renderedTexts = drawTextCalls.map((call) => call.text)
    expect(renderedTexts).toContain('Ligne facture 1')
    expect(renderedTexts).toContain('Ligne facture 37')
    expect(renderedTexts).not.toContain('Ligne facture 38')
    expect(renderedTexts).not.toContain('Ligne facture 50')
    expect(renderedTexts).toContain(eur(600))

    const line37 = drawTextCalls.find((call) => call.text === 'Ligne facture 37')
    expect(line37).toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ x: 40, y: 152, size: 9, font: 'Helvetica' }),
      })
    )
  })

  it('rejette la promesse quand la création du document PDF échoue', async () => {
    mockCreate.mockRejectedValueOnce(new Error('pdf create failed'))

    await expect(generateFacturXPdf(buildInput())).rejects.toThrow('pdf create failed')

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockAddPage).not.toHaveBeenCalled()
    expect(mockAttach).not.toHaveBeenCalled()
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('rejette la promesse quand l’attachement XML échoue sans sauvegarder le PDF', async () => {
    mockAttach.mockRejectedValueOnce(new Error('xml attach failed'))

    await expect(generateFacturXPdf(buildInput())).rejects.toThrow('xml attach failed')

    expect(mockAttach).toHaveBeenCalledTimes(1)
    expect(mockSave).not.toHaveBeenCalled()
  })
})

describe('downloadBlob', () => {
  it('crée une URL objet, déclenche le téléchargement avec le nom fourni puis révoque l’URL', () => {
    const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
    const createObjectURL = vi.fn(() => 'blob:facturx-pdf')
    const revokeObjectURL = vi.fn()
    const createdAnchors: HTMLAnchorElement[] = []
    const realCreateElement = document.createElement.bind(document)

    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string, options?: ElementCreationOptions): HTMLElement => {
        const element = realCreateElement(tagName, options)
        if (tagName.toLowerCase() === 'a') {
          createdAnchors.push(element as HTMLAnchorElement)
        }
        return element
      })

    try {
      const blob = new Blob(['pdf'], { type: 'application/pdf' })

      downloadBlob(blob, 'facture-f-24-01.pdf')

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(createObjectURL).toHaveBeenCalledWith(blob)
      expect(createdAnchors).toHaveLength(1)

      const anchor = createdAnchors.at(0)
      if (anchor === undefined) {
        throw new Error('ancre de téléchargement manquante')
      }

      expect(anchor.href).toBe('blob:facturx-pdf')
      expect(anchor.download).toBe('facture-f-24-01.pdf')
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:facturx-pdf')
    } finally {
      clickSpy.mockRestore()
      createElementSpy.mockRestore()

      if (createObjectUrlDescriptor === undefined) {
        Reflect.deleteProperty(URL, 'createObjectURL')
      } else {
        Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor)
      }

      if (revokeObjectUrlDescriptor === undefined) {
        Reflect.deleteProperty(URL, 'revokeObjectURL')
      } else {
        Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor)
      }
    }
  })
})
