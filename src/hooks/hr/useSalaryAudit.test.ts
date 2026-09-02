import { beforeAll, beforeEach, describe, it } from 'vitest';

const {
  STATE,
  AUTH_SESSION_RES,
  AUTH_NO_SESSION_RES,
  INSERT_OK_RESULT,
  INSERT_ERROR_RESULT,
  insertErrorObject,
  insertCalls,
  fromCalls,
  createBuilder,
  mockFrom,
  supabaseMock,
  debugWarn,
} = vi.hoisted(() => {
  const insertCalls: any[] = [];
  const fromCalls: string[] = [];

  const insertErrorObject = { message: '' as string };
  const INSERT_OK_RESULT = { data: null, error: null as null | { message: string } };
  const INSERT_ERROR_RESULT = { data: null, error: insertErrorObject };

  const STATE = {
    authResponse: null as unknown,
    getSessionThrows: false,
    insertHasError: false,
  };

  const createBuilder = () => {
    const builder: any = {
      _lastInsert: null as any,
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: (payload: any) => {
        insertCalls.push(payload);
        builder._lastInsert = payload;
        return builder;
      },
      update: () => builder,
      delete: () => builder,
      single: () => Promise.resolve(INSERT_OK_RESULT),
      maybeSingle: () => Promise.resolve(INSERT_OK_RESULT),
      then: (onFulfilled: (v: any) => any, onRejected?: (reason: any) => any) => {
        const res = STATE.insertHasError ? INSERT_ERROR_RESULT : INSERT_OK_RESULT;
        return Promise.resolve(res).then(onFulfilled, onRejected);
      },
      catch: (onRejected: (reason: any) => any) => {
        return Promise.resolve().catch(onRejected);
      },
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    fromCalls.push(table);
    return createBuilder();
  });

  const supabaseMock = {
    auth: {
      getSession: vi.fn(() => {
        if (STATE.getSessionThrows) {
          return Promise.reject(new Error('session-error'));
        }
        return Promise.resolve(STATE.authResponse);
      }),
    },
    from: mockFrom,
  };

  const debugWarn = vi.fn();

  const AUTH_SESSION_RES = {
    data: { session: { user: { id: 'u1', email: 'u@example.com' } } },
    error: null,
  };
  const AUTH_NO_SESSION_RES = {
    data: { session: null },
    error: null,
  };

  return {
    STATE,
    AUTH_SESSION_RES,
    AUTH_NO_SESSION_RES,
    INSERT_OK_RESULT,
    INSERT_ERROR_RESULT,
    insertErrorObject,
    insertCalls,
    fromCalls,
    createBuilder,
    mockFrom,
    supabaseMock,
    debugWarn,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

vi.mock('@/lib/debug', () => ({
  debug: { warn: debugWarn },
}));

import { logSalaryAccess, logSalaryBatchView, logSalaryExport } from './useSalaryAudit';

describe('useSalaryAudit: logSalaryAccess and helpers', () => {
  beforeAll(() => {
    vi.stubEnv('DEV', 'true');
  });

  beforeEach(() => {
    STATE.authResponse = AUTH_SESSION_RES;
    STATE.getSessionThrows = false;
    STATE.insertHasError = false;
    insertCalls.length = 0;
    fromCalls.length = 0;
    mockFrom.mockClear();
    (supabaseMock.auth.getSession as any).mockClear();
    debugWarn.mockClear();
    insertErrorObject.message = '';
  });

  it('logs a salary access with correct payload when session is present', async () => {
    await logSalaryAccess({
      targetProfileId: 'p1',
      targetEmployeeName: 'John Doe',
      accessType: 'VIEW',
      salaryMonth: '2024-05',
      details: { foo: 'bar', count: 1 },
    });

    expect(supabaseMock.auth.getSession).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(fromCalls[0]).toBe('salary_access_log');
    expect(insertCalls.length).toBe(1);

    const payload = insertCalls[0];
    expect(payload.accessor_user_id).toBe('u1');
    expect(payload.accessor_email).toBe('u@example.com');
    expect(payload.target_profile_id).toBe('p1');
    expect(payload.target_employee_name).toBe('John Doe');
    expect(payload.access_type).toBe('VIEW');
    expect(payload.salary_month).toBe('2024-05');
    expect(payload.user_agent).toBe(navigator.userAgent);
    expect(typeof payload.details).toBe('string');
    const detailsObj = JSON.parse(payload.details);
    expect(detailsObj).toEqual({ foo: 'bar', count: 1 });

    expect(debugWarn).not.toHaveBeenCalled();
  });

  it('does not insert when no session is available', async () => {
    STATE.authResponse = AUTH_NO_SESSION_RES;

    await logSalaryAccess({
      accessType: 'VIEW',
      salaryMonth: '2024-06',
      details: { a: 1 },
    });

    expect(supabaseMock.auth.getSession).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(insertCalls.length).toBe(0);
    expect(debugWarn).not.toHaveBeenCalled();
  });

  it('stringifies details, or sets null when details not provided', async () => {
    await logSalaryAccess({
      accessType: 'UPDATE',
      targetEmployeeName: 'Jane',
      salaryMonth: '2024-07',
    });

    expect(insertCalls.length).toBe(1);
    const payload = insertCalls[0];
    expect(payload.details).toBeNull();
    expect(payload.access_type).toBe('UPDATE');
    expect(payload.target_employee_name).toBe('Jane');
  });

  it('warns in DEV when the insert thenable resolves with an error', async () => {
    STATE.insertHasError = true;
    insertErrorObject.message = 'insert failed!';

    await logSalaryAccess({
      accessType: 'DELETE',
      targetProfileId: 'p2',
      salaryMonth: '2024-08',
      details: { reason: 'cleanup' },
    });

    // allow the thenable to flush
    await Promise.resolve();
    await Promise.resolve();

    expect(insertCalls.length).toBe(1);
    expect(debugWarn).toHaveBeenCalledTimes(1);
    const [msg, errMsg] = debugWarn.mock.calls[0];
    expect(msg).toBe('Salary audit log failed:');
    expect(errMsg).toBe('insert failed!');
  });

  it('catches and warns if getSession throws, without attempting insert', async () => {
    STATE.getSessionThrows = true;

    await logSalaryAccess({
      accessType: 'VIEW',
      salaryMonth: '2024-09',
    });

    expect(insertCalls.length).toBe(0);
    expect(debugWarn).toHaveBeenCalledTimes(1);
    const [msg, err] = debugWarn.mock.calls[0];
    expect(msg).toBe('Salary audit logging error:');
    expect(err).toBeInstanceOf(Error);
  });

  it('logSalaryBatchView delegates with proper details', async () => {
    await logSalaryBatchView('2024-10', 42);

    expect(insertCalls.length).toBe(1);
    const payload = insertCalls[0];
    expect(payload.access_type).toBe('VIEW');
    expect(payload.salary_month).toBe('2024-10');
    expect(typeof payload.details).toBe('string');
    const details = JSON.parse(payload.details);
    expect(details).toEqual({ batch_view: true, employee_count: 42 });
  });

  it('logSalaryExport delegates with proper details', async () => {
    await logSalaryExport('2024-11', 'csv', 10);

    expect(insertCalls.length).toBe(1);
    const payload = insertCalls[0];
    expect(payload.access_type).toBe('EXPORT');
    expect(payload.salary_month).toBe('2024-11');
    const details = JSON.parse(payload.details);
    expect(details.export_format).toBe('csv');
    expect(details.employee_count).toBe(10);
  });
});