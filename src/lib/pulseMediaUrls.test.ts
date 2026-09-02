const {
  ROWS,
  SIGNED_URL,
  SIGNED_IMAGE_URL,
  SIGNED_VIDEO_URL,
  PUBLIC_URL,
  SIGNED_RESULT,
  SIGNED_IMAGE_RESULT,
  SIGNED_VIDEO_RESULT,
  SIGNED_ERROR,
  SIGNED_ERROR_RESULT,
  SIGNED_EMPTY_RESULT,
  PUBLIC_RESULT,
  PUBLIC_EMPTY_RESULT,
  bucketWithSigned,
  bucketWithoutSigned,
  mockFrom,
  mockStorageFrom,
  mockCreateSignedUrl,
  mockGetPublicUrl,
  resetQueryResults,
} = vi.hoisted(() => {
  type DbRow = { id: string }
  type DbError = { message: string }
  type QueryResult = { data: DbRow[] | null; error: DbError | null }
  type ThenHandler = (value: QueryResult) => unknown
  type CatchHandler = (reason: unknown) => unknown
  type ChainMethod = (...values: unknown[]) => Builder
  type ResolveMethod = () => Promise<QueryResult>
  type ThenMethod = (
    onfulfilled?: ThenHandler | null,
    onrejected?: CatchHandler | null
  ) => Promise<unknown>
  type CatchMethod = (onrejected?: CatchHandler | null) => Promise<unknown>

  type Builder = {
    select: ChainMethod
    eq: ChainMethod
    gte: ChainMethod
    lte: ChainMethod
    in: ChainMethod
    order: ChainMethod
    limit: ChainMethod
    insert: ChainMethod
    update: ChainMethod
    delete: ChainMethod
    single: ResolveMethod
    maybeSingle: ResolveMethod
    then: ThenMethod
    catch: CatchMethod
  }

  type SignedUrlResult = {
    data: { signedUrl?: string } | null
    error: DbError | null
  }
  type PublicUrlResult = { data: { publicUrl: string } }
  type CreateSignedUrl = (
    storagePath: string,
    ttl: number,
    options?: { download: string }
  ) => Promise<SignedUrlResult>
  type GetPublicUrl = (storagePath: string) => PublicUrlResult
  type StorageBucket = {
    createSignedUrl?: CreateSignedUrl
    getPublicUrl?: GetPublicUrl
  }
  type StorageFrom = (bucketName: string) => StorageBucket
  type TableFrom = (tableName: string) => Builder

  const ROWS: DbRow[] = [{ id: 'row-1' }]
  const QUERY_RESULT: QueryResult = { data: ROWS, error: null }
  const SINGLE_RESULT: QueryResult = { data: ROWS, error: null }

  let currentQueryResult = QUERY_RESULT
  let currentSingleResult = SINGLE_RESULT

  const mockBuilder = {} as Builder
  mockBuilder.select = vi.fn<ChainMethod>(() => mockBuilder)
  mockBuilder.eq = vi.fn<ChainMethod>(() => mockBuilder)
  mockBuilder.gte = vi.fn<ChainMethod>(() => mockBuilder)
  mockBuilder.lte = vi.fn<ChainMethod>(() => mockBuilder)
  mockBuilder.in = vi.fn<ChainMethod>(() => mockBuilder)
  mockBuilder.order = vi.fn<ChainMethod>(() => mockBuilder)
  mockBuilder.limit = vi.fn<ChainMethod>(() => mockBuilder)
  mockBuilder.insert = vi.fn<ChainMethod>(() => mockBuilder)
  mockBuilder.update = vi.fn<ChainMethod>(() => mockBuilder)
  mockBuilder.delete = vi.fn<ChainMethod>(() => mockBuilder)
  mockBuilder.single = vi.fn<ResolveMethod>(() => Promise.resolve(currentSingleResult))
  mockBuilder.maybeSingle = vi.fn<ResolveMethod>(() => Promise.resolve(currentSingleResult))
  mockBuilder.then = vi.fn<ThenMethod>((onfulfilled, onrejected) =>
    Promise.resolve(currentQueryResult).then(onfulfilled ?? undefined, onrejected ?? undefined)
  )
  mockBuilder.catch = vi.fn<CatchMethod>((onrejected) =>
    Promise.resolve(currentQueryResult).catch(onrejected ?? undefined)
  )

  const SIGNED_URL = 'https://example.test/media/signed'
  const SIGNED_IMAGE_URL = 'https://example.test/media/image'
  const SIGNED_VIDEO_URL = 'https://example.test/media/video'
  const PUBLIC_URL = 'https://example.test/media/public'

  const SIGNED_ERROR: DbError = { message: 'x' }
  const SIGNED_RESULT: SignedUrlResult = { data: { signedUrl: SIGNED_URL }, error: null }
  const SIGNED_IMAGE_RESULT: SignedUrlResult = {
    data: { signedUrl: SIGNED_IMAGE_URL },
    error: null,
  }
  const SIGNED_VIDEO_RESULT: SignedUrlResult = {
    data: { signedUrl: SIGNED_VIDEO_URL },
    error: null,
  }
  const SIGNED_ERROR_RESULT: SignedUrlResult = { data: null, error: SIGNED_ERROR }
  const SIGNED_EMPTY_RESULT: SignedUrlResult = { data: {}, error: null }
  const PUBLIC_RESULT: PublicUrlResult = { data: { publicUrl: PUBLIC_URL } }
  const PUBLIC_EMPTY_RESULT: PublicUrlResult = { data: { publicUrl: '' } }

  const mockCreateSignedUrl = vi.fn<CreateSignedUrl>(() => Promise.resolve(SIGNED_RESULT))
  const mockGetPublicUrl = vi.fn<GetPublicUrl>(() => PUBLIC_RESULT)

  const bucketWithSigned: StorageBucket = {
    createSignedUrl: mockCreateSignedUrl,
    getPublicUrl: mockGetPublicUrl,
  }
  const bucketWithoutSigned: StorageBucket = {
    getPublicUrl: mockGetPublicUrl,
  }

  const mockStorageFrom = vi.fn<StorageFrom>(() => bucketWithSigned)
  const mockFrom = vi.fn<TableFrom>(() => mockBuilder)

  const resetQueryResults = () => {
    currentQueryResult = QUERY_RESULT
    currentSingleResult = SINGLE_RESULT
  }

  return {
    ROWS,
    SIGNED_URL,
    SIGNED_IMAGE_URL,
    SIGNED_VIDEO_URL,
    PUBLIC_URL,
    SIGNED_RESULT,
    SIGNED_IMAGE_RESULT,
    SIGNED_VIDEO_RESULT,
    SIGNED_ERROR,
    SIGNED_ERROR_RESULT,
    SIGNED_EMPTY_RESULT,
    PUBLIC_RESULT,
    PUBLIC_EMPTY_RESULT,
    bucketWithSigned,
    bucketWithoutSigned,
    mockFrom,
    mockStorageFrom,
    mockCreateSignedUrl,
    mockGetPublicUrl,
    resetQueryResults,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  },
}))

import type { PulseMedia } from '@/types/pulse'
import {
  PULSE_MEDIA_ACCEPT,
  PULSE_MEDIA_ALLOWED_TYPES,
  PULSE_MEDIA_BUCKET,
  PULSE_MEDIA_MAX_FILE_SIZE,
  PULSE_MEDIA_SIGNED_URL_TTL_SECONDS,
  getPulseMediaSignedUrl,
  getPulseMediaSignedUrlOrThrow,
  getPulseMediaType,
  refreshPulseMediaUrls,
  validatePulseMediaFile,
} from './pulseMediaUrls'

describe('pulseMediaUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryResults()

    mockFrom.mockReset()
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ROWS),
      eq: vi.fn(() => ROWS),
      gte: vi.fn(() => ROWS),
      lte: vi.fn(() => ROWS),
      in: vi.fn(() => ROWS),
      order: vi.fn(() => ROWS),
      limit: vi.fn(() => ROWS),
      insert: vi.fn(() => ROWS),
      update: vi.fn(() => ROWS),
      delete: vi.fn(() => ROWS),
      single: vi.fn(() => Promise.resolve({ data: ROWS, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: ROWS, error: null })),
      then: vi.fn((onfulfilled?: (value: { data: typeof ROWS; error: null }) => unknown) =>
        Promise.resolve({ data: ROWS, error: null }).then(onfulfilled)
      ),
      catch: vi.fn((onrejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: ROWS, error: null }).catch(onrejected)
      ),
    }))

    mockStorageFrom.mockReset()
    mockStorageFrom.mockReturnValue(bucketWithSigned)

    mockCreateSignedUrl.mockReset()
    mockCreateSignedUrl.mockResolvedValue(SIGNED_RESULT)

    mockGetPublicUrl.mockReset()
    mockGetPublicUrl.mockReturnValue(PUBLIC_RESULT)
  })

  describe('constants', () => {
    it('exposes the expected bucket, limits, accepted MIME types and accept string', () => {
      expect(PULSE_MEDIA_BUCKET).toBe('pulse-media')
      expect(PULSE_MEDIA_SIGNED_URL_TTL_SECONDS).toBe(31_536_000)
      expect(PULSE_MEDIA_MAX_FILE_SIZE).toBe(52_428_800)

      expect(Object.keys(PULSE_MEDIA_ALLOWED_TYPES)).toHaveLength(16)
      expect(PULSE_MEDIA_ALLOWED_TYPES).toMatchObject({
        'image/jpeg': 'image',
        'image/png': 'image',
        'video/mp4': 'video',
        'audio/ogg': 'audio',
        'application/pdf': 'document',
        'text/csv': 'document',
      })

      expect(PULSE_MEDIA_ACCEPT.split(',')).toEqual([
        'image/*',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.txt',
        '.csv',
      ])
    })
  })

  describe('getPulseMediaType', () => {
    it.each([
      ['image/jpeg', 'image'],
      ['image/webp', 'image'],
      ['video/webm', 'video'],
      ['audio/wav', 'audio'],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'],
      ['application/octet-stream', 'other'],
      ['', 'other'],
    ])('maps %s to %s', (mimeType, expectedType) => {
      expect(getPulseMediaType(mimeType)).toBe(expectedType)
    })
  })

  describe('validatePulseMediaFile', () => {
    it('returns null for a supported file within the size limit', () => {
      const file = new File(['ok'], 'image.png', { type: 'image/png' })
      Object.defineProperty(file, 'size', { value: PULSE_MEDIA_MAX_FILE_SIZE })

      expect(validatePulseMediaFile(file)).toBeNull()
    })

    it('returns a size error before MIME validation when the file is too large', () => {
      const file = new File(['x'], 'large.png', { type: 'image/png' })
      Object.defineProperty(file, 'size', { value: PULSE_MEDIA_MAX_FILE_SIZE + 1 })

      expect(validatePulseMediaFile(file)).toBe('La taille maximale est de 50 Mo')
    })

    it('returns an unsupported type error for an unknown MIME type', () => {
      const file = new File(['x'], 'archive.zip', { type: 'application/zip' })

      expect(validatePulseMediaFile(file)).toBe('Type de fichier non pris en charge')
    })
  })

  describe('getPulseMediaSignedUrl', () => {
    it('returns null and does not call storage for empty paths', async () => {
      await expect(getPulseMediaSignedUrl(null)).resolves.toBeNull()
      await expect(getPulseMediaSignedUrl(undefined)).resolves.toBeNull()
      await expect(getPulseMediaSignedUrl('')).resolves.toBeNull()

      expect(mockStorageFrom).not.toHaveBeenCalled()
      expect(mockCreateSignedUrl).not.toHaveBeenCalled()
    })

    it('creates a signed URL with the pulse media bucket and TTL', async () => {
      await expect(getPulseMediaSignedUrl('uploads/image.png')).resolves.toBe(SIGNED_URL)

      expect(mockStorageFrom).toHaveBeenCalledTimes(2)
      expect(mockStorageFrom).toHaveBeenCalledWith(PULSE_MEDIA_BUCKET)
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1)
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        'uploads/image.png',
        PULSE_MEDIA_SIGNED_URL_TTL_SECONDS,
        undefined
      )
    })

    it('passes a download filename when provided', async () => {
      await expect(
        getPulseMediaSignedUrl('docs/report.pdf', { downloadFileName: 'report.pdf' })
      ).resolves.toBe(SIGNED_URL)

      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        'docs/report.pdf',
        PULSE_MEDIA_SIGNED_URL_TTL_SECONDS,
        { download: 'report.pdf' }
      )
    })

    it('returns null when Supabase returns an error or no signed URL', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce(SIGNED_ERROR_RESULT)
      await expect(getPulseMediaSignedUrl('uploads/broken.png')).resolves.toBeNull()

      mockCreateSignedUrl.mockResolvedValueOnce(SIGNED_EMPTY_RESULT)
      await expect(getPulseMediaSignedUrl('uploads/empty.png')).resolves.toBeNull()
    })

    it('falls back to public URLs when createSignedUrl is unavailable', async () => {
      mockStorageFrom.mockReturnValueOnce(bucketWithoutSigned)

      await expect(getPulseMediaSignedUrl('legacy/file.txt')).resolves.toBe(PUBLIC_URL)

      expect(mockGetPublicUrl).toHaveBeenCalledTimes(1)
      expect(mockGetPublicUrl).toHaveBeenCalledWith('legacy/file.txt')
      expect(mockCreateSignedUrl).not.toHaveBeenCalled()
    })

    it('returns the fallback public URL value when it is an empty string', async () => {
      mockStorageFrom.mockReturnValueOnce(bucketWithoutSigned)
      mockGetPublicUrl.mockReturnValueOnce(PUBLIC_EMPTY_RESULT)

      await expect(getPulseMediaSignedUrl('legacy/missing.txt')).resolves.toBe('')
      expect(mockGetPublicUrl).toHaveBeenCalledWith('legacy/missing.txt')
    })
  })

  describe('getPulseMediaSignedUrlOrThrow', () => {
    it('returns the signed URL for a valid storage path', async () => {
      await expect(getPulseMediaSignedUrlOrThrow('uploads/audio.ogg')).resolves.toBe(SIGNED_URL)

      expect(mockStorageFrom).toHaveBeenCalledWith(PULSE_MEDIA_BUCKET)
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        'uploads/audio.ogg',
        PULSE_MEDIA_SIGNED_URL_TTL_SECONDS
      )
    })

    it('throws the Supabase error when signing fails', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce(SIGNED_ERROR_RESULT)

      await expect(getPulseMediaSignedUrlOrThrow('uploads/error.png')).rejects.toEqual(SIGNED_ERROR)
    })

    it('throws a clear error when Supabase does not return a signed URL', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce(SIGNED_EMPTY_RESULT)

      await expect(getPulseMediaSignedUrlOrThrow('uploads/empty.png')).rejects.toThrow(
        'Impossible de générer le lien du fichier'
      )
    })

    it('returns the public URL fallback when signing is unavailable', async () => {
      mockStorageFrom.mockReturnValueOnce(bucketWithoutSigned)
      mockGetPublicUrl.mockReturnValueOnce(PUBLIC_RESULT)

      await expect(getPulseMediaSignedUrlOrThrow('legacy/public.csv')).resolves.toBe(PUBLIC_URL)

      expect(mockGetPublicUrl).toHaveBeenCalledWith('legacy/public.csv')
      expect(mockCreateSignedUrl).not.toHaveBeenCalled()
    })

    it('throws when the public URL fallback cannot generate a URL', async () => {
      mockStorageFrom.mockReturnValueOnce(bucketWithoutSigned)
      mockGetPublicUrl.mockReturnValueOnce(PUBLIC_EMPTY_RESULT)

      await expect(getPulseMediaSignedUrlOrThrow('legacy/missing.csv')).rejects.toThrow(
        'Impossible de générer le lien du fichier'
      )
    })
  })

  describe('refreshPulseMediaUrls', () => {
    it('refreshes file URLs and image thumbnails while preserving messages without media', async () => {
      mockCreateSignedUrl.mockImplementation((storagePath: string) => {
        if (storagePath === 'pulse/image.png') return Promise.resolve(SIGNED_IMAGE_RESULT)
        if (storagePath === 'pulse/video.mp4') return Promise.resolve(SIGNED_VIDEO_RESULT)
        return Promise.resolve(SIGNED_ERROR_RESULT)
      })

      const untouchedMessage = { id: 'msg-0', text: 'no media' }
      const messages = [
        untouchedMessage,
        {
          id: 'msg-1',
          media: [
            {
              id: 'media-1',
              message_id: 'msg-1',
              file_name: 'image.png',
              file_url: 'old-image-url',
              storage_path: 'pulse/image.png',
              file_type: 'image',
              mime_type: 'image/png',
              file_size: 12,
              thumbnail_url: 'old-image-thumb',
              created_at: '2024-01-01T00:00:00.000Z',
              uploaded_by: 'user-1',
            },
            {
              id: 'media-2',
              message_id: 'msg-1',
              file_name: 'video.mp4',
              file_url: 'old-video-url',
              storage_path: 'pulse/video.mp4',
              file_type: 'video',
              mime_type: 'video/mp4',
              file_size: 24,
              thumbnail_url: 'old-video-thumb',
              created_at: '2024-01-01T00:00:00.000Z',
              uploaded_by: 'user-1',
            },
          ],
        },
      ] as unknown as Array<{ id: string; text?: string; media?: PulseMedia[] }>

      const result = await refreshPulseMediaUrls(messages)

      expect(result).toHaveLength(2)
      expect(result[0]).toBe(untouchedMessage)
      expect(result[1]).not.toBe(messages[1])

      const refreshedMedia = result[1]?.media
      expect(refreshedMedia).toHaveLength(2)
      expect(refreshedMedia?.[0]?.file_url).toBe(SIGNED_IMAGE_URL)
      expect(refreshedMedia?.[0]?.thumbnail_url).toBe(SIGNED_IMAGE_URL)
      expect(refreshedMedia?.[1]?.file_url).toBe(SIGNED_VIDEO_URL)
      expect(refreshedMedia?.[1]?.thumbnail_url).toBe('old-video-thumb')

      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2)
      expect(mockCreateSignedUrl).toHaveBeenNthCalledWith(
        1,
        'pulse/image.png',
        PULSE_MEDIA_SIGNED_URL_TTL_SECONDS,
        undefined
      )
      expect(mockCreateSignedUrl).toHaveBeenNthCalledWith(
        2,
        'pulse/video.mp4',
        PULSE_MEDIA_SIGNED_URL_TTL_SECONDS,
        undefined
      )
    })

    it('keeps a media item unchanged when no signed URL can be generated', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce(SIGNED_ERROR_RESULT)

      const originalMedia = {
        id: 'media-3',
        message_id: 'msg-2',
        file_name: 'missing.pdf',
        file_url: 'old-document-url',
        storage_path: 'pulse/missing.pdf',
        file_type: 'document',
        mime_type: 'application/pdf',
        file_size: 36,
        thumbnail_url: null,
        created_at: '2024-01-01T00:00:00.000Z',
        uploaded_by: 'user-1',
      }
      const messages = [{ id: 'msg-2', media: [originalMedia] }] as unknown as Array<{
        id: string
        media?: PulseMedia[]
      }>

      const result = await refreshPulseMediaUrls(messages)

      expect(result[0]?.media?.[0]).toBe(originalMedia)
      expect(result[0]?.media?.[0]?.file_url).toBe('old-document-url')
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        'pulse/missing.pdf',
        PULSE_MEDIA_SIGNED_URL_TTL_SECONDS,
        undefined
      )
    })
  })
})
