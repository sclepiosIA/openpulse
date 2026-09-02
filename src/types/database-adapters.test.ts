// @vitest-environment jsdom

import type { 
  DatabaseQueryRequest, 
  QueryFilter, 
  OrderByClause, 
  MutationValues, 
  SortConfig, 
  SortableField, 
  WidgetConfigOptions, 
  OnlyOfficeDocEditor, 
  OnlyOfficeErrorEvent, 
  DocsAPI 
} from './database-adapters';

describe('database-adapters.ts - type contracts', () => {
  it('defines and uses core types correctly', () => {
    const sampleQuery: DatabaseQueryRequest = {
      table: 'users',
      operation: 'select',
      columns: '*',
      filters: [
        { type: 'eq', column: 'status', value: 'active' }
      ],
      orderBy: [{ column: 'created_at', ascending: true }],
      limit: 100,
      range: { from: 0, to: null },
      values: { status: 'active' }
    };

    // Runtime assertions to ensure values align with the types
    expect(sampleQuery.operation).toBe('select');
    expect(sampleQuery.filters[0].type).toBe('eq');
    expect(sampleQuery.orderBy[0].column).toBe('created_at');
    expect(sampleQuery.range?.from).toBe(0);
    expect(sampleQuery.values).toEqual({ status: 'active' });

    // Mutation values
    type Row = { id: string; name?: string; createdAt?: string; };
    const mv: MutationValues<Row> = { id: 'r1', name: 'Alice' };
    expect(mv.id).toBe('r1');

    // Sort config and sortable field
    const sf: SortableField<Row> = 'name' as any;
    const sc: SortConfig<Row> = { field: sf, direction: 'asc' };
    expect(sc.direction).toBe('asc');

    // Widget config options
    const wco: WidgetConfigOptions = { period: { default: '1d' }, showTrend: { default: true }, maxItems: { max: 50 } };
    expect(wco.showTrend?.default).toBe(true);

    // OnlyOffice types
    const editor: OnlyOfficeDocEditor = { destroyEditor: () => {} };
    expect(typeof editor.destroyEditor).toBe('function');

    const err: OnlyOfficeErrorEvent = { data: { errorCode: 500, errorDescription: 'Something went wrong' } } as any;
    expect(err.data?.errorCode).toBe(500);

    // DocsAPI surface
    const api: DocsAPI = {
      DocEditor: class Dummy implements OnlyOfficeDocEditor { destroyEditor(): void {} } as any
    } as any;

    const docEditor = new api.DocEditor('el', {}) as unknown as OnlyOfficeDocEditor;
    expect(typeof docEditor.destroyEditor).toBe('function');
  });
});