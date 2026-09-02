import { supabase } from './client'

const { STABLE_SUPABASE } = vi.hoisted(() => ({
  STABLE_SUPABASE: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
    rpc: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: STABLE_SUPABASE,
}))

describe('client.ts', () => {
  it('ré-exporte exactement l’instance supabase du module navigateur', () => {
    expect(supabase).toBe(STABLE_SUPABASE)
  })

  it('expose un client utilisable avec des méthodes supabase stables', async () => {
    const chained = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (value: { data: Array<{ id: string }>; error: null }) => unknown) =>
        Promise.resolve(resolve({ data: [{ id: '1' }], error: null })),
      ),
      catch: vi.fn(),
    }

    STABLE_SUPABASE.from.mockReturnValue(chained)

    const result = await supabase.from('items').select('*').eq('id', '1')

    expect(STABLE_SUPABASE.from).toHaveBeenCalledWith('items')
    expect(chained.select).toHaveBeenCalledWith('*')
    expect(chained.eq).toHaveBeenCalledWith('id', '1')
    expect(result).toEqual({ data: [{ id: '1' }], error: null })
  })

  it('conserve la même référence entre plusieurs accès/imports du client', async () => {
    const mod = await import('./client')

    expect(mod.supabase).toBe(supabase)
    expect(mod.supabase.auth).toBe(STABLE_SUPABASE.auth)
    expect(mod.supabase.storage).toBe(STABLE_SUPABASE.storage)
  })
})