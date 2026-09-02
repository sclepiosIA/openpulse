import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }));

import { formatMontant, showUploadSummary } from '../uploadDocumentHelpers';
import { toast } from 'sonner';
const toastMock = toast as unknown as { success: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };

describe('formatMontant', () => {
  it('null/undefined → "N/A"', () => {
    expect(formatMontant(null)).toBe('N/A');
    expect(formatMontant(undefined)).toBe('N/A');
  });
  it('formate avec 2 décimales et "€"', () => {
    expect(formatMontant(1234)).toBe('1234.00 €');
    expect(formatMontant(0)).toBe('0.00 €');
    expect(formatMontant(12.345)).toBe('12.35 €');
  });
  it('gère négatif', () => {
    expect(formatMontant(-50)).toBe('-50.00 €');
  });
});

describe('showUploadSummary', () => {
  beforeEach(() => { toastMock.success.mockClear(); toastMock.warning.mockClear(); });

  it('tout réussi → toast.success avec le bon compte', () => {
    showUploadSummary([
      { file: 'a.pdf', success: true },
      { file: 'b.pdf', success: true },
    ]);
    expect(toastMock.success).toHaveBeenCalledTimes(1);
    expect(toastMock.success.mock.calls[0][0]).toContain('2 bulletin');
    expect(toastMock.warning).not.toHaveBeenCalled();
  });

  it('échecs → toast.warning avec compteurs et liste', () => {
    showUploadSummary([
      { file: 'a.pdf', success: true },
      { file: 'b.pdf', success: false, error: 'boom' },
    ]);
    expect(toastMock.warning).toHaveBeenCalledTimes(1);
    const [msg, opts] = toastMock.warning.mock.calls[0] as [string, { description: string }];
    expect(msg).toContain('1 réussis');
    expect(msg).toContain('1 échoué');
    expect(opts.description).toContain('b.pdf');
    expect(opts.description).toContain('boom');
  });

  it('aucun upload → toast.success "0 bulletin"', () => {
    showUploadSummary([]);
    expect(toastMock.success).toHaveBeenCalled();
  });
});
