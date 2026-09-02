/**
 * Tests unitaires pour useSalaryAudit.
 *
 * Ce module exporte 3 fonctions async (pas de hook React, pas de QueryClient) :
 *   - logSalaryAccess  : log générique
 *   - logSalaryBatchView : appelle logSalaryAccess avec accessType='VIEW'
 *   - logSalaryExport    : appelle logSalaryAccess avec accessType='EXPORT'
 *
 * Comportements testés :
 *   — session valide → insert dans salary_access_log avec les bons champs
 *   — session nulle (utilisateur non connecté) → NO insert (retour immédiat)
 *   — erreur auth.getSession → swallowed (pas de throw)
 *   — erreur insert → swallowed (fire-and-forget)
 *   — logSalaryBatchView → délègue avec les bons détails
 *   — logSalaryExport → délègue avec le bon format
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks stables avec vi.hoisted ───────────────────────────────────────────
const mockInsert = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockGetSession = vi.hoisted(() => vi.fn())

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: mockGetSession,
    },
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    maskId: vi.fn((id: string) => `${id.slice(0, 6)}***`),
  },
}))

import { logSalaryAccess, logSalaryBatchView, logSalaryExport } from '@/hooks/hr/useSalaryAudit'
import { supabase } from '@/integrations/supabase/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MOCK_SESSION = {
  user: {
    id: 'user-audit-1',
    email: 'rh@hopital.fr',
  },
  access_token: 'mock-token',
}

function setupSession(session: typeof MOCK_SESSION | null = MOCK_SESSION) {
  mockGetSession.mockResolvedValue({ data: { session }, error: null })
}

function setupInsert(error: { message: string } | null = null) {
  const insertChain = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error }).then(resolve),
  }
  const fromChain = { insert: mockInsert.mockReturnValue(insertChain) }
  mockFrom.mockReturnValue(fromChain)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('logSalaryAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('appelle supabase.from("salary_access_log").insert() quand session valide', async () => {
    setupSession()
    setupInsert()

    await logSalaryAccess({
      accessType: 'VIEW',
      targetProfileId: 'profile-123',
      targetEmployeeName: 'Marie Dupont',
      salaryMonth: '2026-05',
    })

    // Le log est fire-and-forget : on attend la résolution des microtasks
    await new Promise((r) => setTimeout(r, 0))

    expect(mockFrom).toHaveBeenCalledWith('salary_access_log')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        accessor_user_id: 'user-audit-1',
        accessor_email: 'rh@hopital.fr',
        target_profile_id: 'profile-123',
        target_employee_name: 'Marie Dupont',
        access_type: 'VIEW',
        salary_month: '2026-05',
      })
    )
  })

  it('insère le user_agent du navigateur', async () => {
    setupSession()
    setupInsert()

    await logSalaryAccess({ accessType: 'VIEW' })
    await new Promise((r) => setTimeout(r, 0))

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_agent: navigator.userAgent,
      })
    )
  })

  it('sérialise details en JSON', async () => {
    setupSession()
    setupInsert()

    await logSalaryAccess({
      accessType: 'EXPORT',
      details: { export_format: 'xlsx', employee_count: 12 },
    })
    await new Promise((r) => setTimeout(r, 0))

    const insertArg = mockInsert.mock.calls[0][0]
    const parsedDetails = JSON.parse(insertArg.details)
    expect(parsedDetails.export_format).toBe('xlsx')
    expect(parsedDetails.employee_count).toBe(12)
  })

  it("ne fait PAS d'insert quand session est null (utilisateur déconnecté)", async () => {
    setupSession(null)
    setupInsert()

    await logSalaryAccess({ accessType: 'VIEW' })
    await new Promise((r) => setTimeout(r, 0))

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("ne lance pas d'erreur si auth.getSession rejette", async () => {
    mockGetSession.mockRejectedValue(new Error('Auth failure'))
    setupInsert()

    // Ne doit pas throw
    await expect(logSalaryAccess({ accessType: 'VIEW' })).resolves.toBeUndefined()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("ne lance pas d'erreur si insert échoue (fire-and-forget)", async () => {
    setupSession()
    // Simule un insert qui retourne une erreur
    const errorChain = {
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ error: { message: 'Insert failed' } }).then(resolve),
    }
    mockFrom.mockReturnValue({ insert: mockInsert.mockReturnValue(errorChain) })

    await expect(logSalaryAccess({ accessType: 'CREATE' })).resolves.toBeUndefined()
  })

  it('sérialise details=null quand non fourni', async () => {
    setupSession()
    setupInsert()

    await logSalaryAccess({ accessType: 'DELETE' })
    await new Promise((r) => setTimeout(r, 0))

    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.details).toBeNull()
  })

  describe("types d'accès", () => {
    const accessTypes = ['VIEW', 'EXPORT', 'CREATE', 'UPDATE', 'DELETE'] as const

    for (const accessType of accessTypes) {
      it(`enregistre accessType=${accessType} correctement`, async () => {
        setupSession()
        setupInsert()

        await logSalaryAccess({ accessType })
        await new Promise((r) => setTimeout(r, 0))

        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({ access_type: accessType })
        )
        vi.clearAllMocks()
      })
    }
  })
})

describe('logSalaryBatchView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('appelle logSalaryAccess avec accessType=VIEW et les bons détails', async () => {
    setupSession()
    setupInsert()

    await logSalaryBatchView('2026-05', 25)
    await new Promise((r) => setTimeout(r, 0))

    expect(mockFrom).toHaveBeenCalledWith('salary_access_log')
    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.access_type).toBe('VIEW')
    expect(insertArg.salary_month).toBe('2026-05')

    const details = JSON.parse(insertArg.details)
    expect(details.batch_view).toBe(true)
    expect(details.employee_count).toBe(25)
  })

  it('fonctionne avec 0 employés', async () => {
    setupSession()
    setupInsert()

    await logSalaryBatchView('2026-06', 0)
    await new Promise((r) => setTimeout(r, 0))

    const insertArg = mockInsert.mock.calls[0][0]
    const details = JSON.parse(insertArg.details)
    expect(details.employee_count).toBe(0)
  })
})

describe('logSalaryExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('appelle logSalaryAccess avec accessType=EXPORT et format csv', async () => {
    setupSession()
    setupInsert()

    await logSalaryExport('2026-05', 'csv', 30)
    await new Promise((r) => setTimeout(r, 0))

    expect(mockFrom).toHaveBeenCalledWith('salary_access_log')
    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.access_type).toBe('EXPORT')
    expect(insertArg.salary_month).toBe('2026-05')

    const details = JSON.parse(insertArg.details)
    expect(details.export_format).toBe('csv')
    expect(details.employee_count).toBe(30)
  })

  it('log correctement le format xlsx', async () => {
    setupSession()
    setupInsert()

    await logSalaryExport('2026-04', 'xlsx', 15)
    await new Promise((r) => setTimeout(r, 0))

    const insertArg = mockInsert.mock.calls[0][0]
    const details = JSON.parse(insertArg.details)
    expect(details.export_format).toBe('xlsx')
  })

  it('log correctement le format pdf', async () => {
    setupSession()
    setupInsert()

    await logSalaryExport('2026-03', 'pdf', 8)
    await new Promise((r) => setTimeout(r, 0))

    const insertArg = mockInsert.mock.calls[0][0]
    const details = JSON.parse(insertArg.details)
    expect(details.export_format).toBe('pdf')
    expect(details.employee_count).toBe(8)
  })
})
