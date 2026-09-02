import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installSandboxGuard, resetSandboxGuardForTests, setSandboxFlag } from '@/lib/sandboxGuard';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

function createSupabaseMock() {
  const builder = {
    upsert: vi.fn((_payload?: unknown) => Promise.resolve({ data: [], error: null })),
    insert: vi.fn((_payload?: unknown) => Promise.resolve({ data: [], error: null })),
    update: vi.fn((_payload?: unknown) => Promise.resolve({ data: [], error: null })),
    delete: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };

  return {
    builder,
    client: {
      from: vi.fn((_table: string) => builder),
      functions: { invoke: vi.fn(() => Promise.resolve({ data: null, error: null })) },
      storage: { from: vi.fn(() => ({})) },
    },
  };
}

describe('sandboxGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSandboxGuardForTests();
  });

  it('bloque silencieusement pulse_presence en sandbox pour éviter le spam Pulse', async () => {
    const { client } = createSupabaseMock();
    installSandboxGuard(client);
    setSandboxFlag(true);

    const result: any = await client.from('pulse_presence').upsert({ status: 'active' });

    expect(result.error?.code).toBe('SANDBOX_BLOCKED');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('garde un toast pour les autres écritures bloquées', async () => {
    const { client } = createSupabaseMock();
    installSandboxGuard(client);
    setSandboxFlag(true);

    const result = await client.from('contrats').delete().then((value: unknown) => value);

    expect(result).toMatchObject({ error: { code: 'SANDBOX_BLOCKED' } });
    expect(toast.error).toHaveBeenCalledWith('Mode démo : action bloquée', { description: 'delete contrats' });
  });
});