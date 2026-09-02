/* @vitest-environment jsdom */

import { applyThreadFilters, EMAIL_THREAD_SELECT } from './threadQuery';

const { createBuilder } = vi.hoisted(() => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      or: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      is: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: vi.fn((onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve(onFulfilled({ data: null, error: null }))
      ),
      catch: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    return builder;
  };

  return { createBuilder };
});

vi.mock('@/integrations/supabase/client', () => {
  const builder = createBuilder();
  return {
    supabase: {
      from: vi.fn(() => builder),
    },
  };
});

describe('threadQuery', () => {
  it('exports the shared select clause with expected fields', () => {
    expect(EMAIL_THREAD_SELECT).toContain('id, thread_id, user_email_account_id, subject, participants');
    expect(EMAIL_THREAD_SELECT).toContain('account:user_email_accounts(email_address)');
    expect(EMAIL_THREAD_SELECT).toContain('etablissement:etablissements(');
    expect(EMAIL_THREAD_SELECT).toContain('groupe:groupes_etablissements(id, nom, type)');
    expect(EMAIL_THREAD_SELECT).toContain('partenaire:partenaires(id, nom, type_partenaire, ville, statut_relation)');
  });

  it('applies search, category, priority, unread, unprocessed and inbox mailbox filters', () => {
    const query = createBuilder();

    const result = applyThreadFilters(query, {
      search: 'urgent',
      filters: {
        category: 'Support',
        priority: 'high',
        unreadOnly: true,
        unprocessedOnly: true,
        mailbox: 'inbox',
      },
    });

    expect(result).toBe(query);
    expect(query.or).toHaveBeenNthCalledWith(
      1,
      'subject.ilike.%urgent%,ai_summary.ilike.%urgent%,ai_generated_title.ilike.%urgent%'
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, 'category', 'Support');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'priority', 'high');
    expect(query.gt).toHaveBeenCalledWith('unread_count', 0);
    expect(query.or).toHaveBeenNthCalledWith(2, 'is_processed.eq.false,is_processed.is.null');
    expect(query.or).toHaveBeenNthCalledWith(3, 'is_outbound.eq.false,is_outbound.is.null');
  });

  it('applies sent mailbox filter', () => {
    const query = createBuilder();

    applyThreadFilters(query, {
      search: '',
      filters: {
        mailbox: 'sent',
      },
    });

    expect(query.eq).toHaveBeenCalledWith('has_sent_messages', true);
    expect(query.or).not.toHaveBeenCalledWith('is_outbound.eq.false,is_outbound.is.null');
  });

  it('applies internal etablissement shortcut by forcing category', () => {
    const query = createBuilder();

    applyThreadFilters(query, {
      search: '',
      filters: {
        etablissementId: 'internal',
      },
    });

    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith('category', 'Interne OpenPulse');
    expect(query.is).not.toHaveBeenCalled();
    expect(query.neq).not.toHaveBeenCalled();
  });

  it('applies unclassified entity filters and excludes internal category', () => {
    const query = createBuilder();

    applyThreadFilters(query, {
      search: '',
      filters: {
        etablissementId: 'unclassified',
      },
    });

    expect(query.is).toHaveBeenNthCalledWith(1, 'etablissement_id', null);
    expect(query.is).toHaveBeenNthCalledWith(2, 'groupe_id', null);
    expect(query.is).toHaveBeenNthCalledWith(3, 'partenaire_id', null);
    expect(query.neq).toHaveBeenCalledWith('category', 'Interne OpenPulse');
    expect(query.eq).not.toHaveBeenCalledWith('etablissement_id', 'unclassified');
  });

  it('applies explicit entity ids for etablissement, groupe and partenaire', () => {
    const query = createBuilder();

    applyThreadFilters(query, {
      search: '',
      filters: {
        etablissementId: 'eta-1',
        groupeId: 'grp-2',
        partenaireId: 'par-3',
      },
    });

    expect(query.eq).toHaveBeenNthCalledWith(1, 'etablissement_id', 'eta-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'groupe_id', 'grp-2');
    expect(query.eq).toHaveBeenNthCalledWith(3, 'partenaire_id', 'par-3');
  });

  it('does not call any filter method when search and filters are empty', () => {
    const query = createBuilder();

    const result = applyThreadFilters(query, {
      search: '',
      filters: {},
    });

    expect(result).toBe(query);
    expect(query.or).not.toHaveBeenCalled();
    expect(query.eq).not.toHaveBeenCalled();
    expect(query.gt).not.toHaveBeenCalled();
    expect(query.is).not.toHaveBeenCalled();
    expect(query.neq).not.toHaveBeenCalled();
  });
});