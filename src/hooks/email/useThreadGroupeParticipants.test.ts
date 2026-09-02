/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockFrom, resetSupabaseState, queueTableResponse, debugError } = vi.hoisted(() => {
	type SupabaseError = { message: string };
	type TableResponse = { data: unknown; error: SupabaseError | null };

	const responsesByTable = new Map<string, TableResponse[]>();

	function ensureQueue(table: string): TableResponse[] {
		const q = responsesByTable.get(table);
		if (q) return q;
		const created: TableResponse[] = [];
		responsesByTable.set(table, created);
		return created;
	}

	function queueTableResponse(table: string, response: TableResponse) {
		ensureQueue(table).push(response);
	}

	function resetSupabaseState() {
		responsesByTable.clear();
		mockFrom.mockClear();
	}

	function resolveResponseForTable(table: string) {
		const q = ensureQueue(table);
		const resp = q.shift();
		if (!resp) return Promise.resolve({ data: null, error: null } satisfies TableResponse);
		return Promise.resolve(resp);
	}

	function createBuilder(table: string) {
		const builder: {
			select: ReturnType<typeof vi.fn>;
			eq: ReturnType<typeof vi.fn>;
			gte: ReturnType<typeof vi.fn>;
			lte: ReturnType<typeof vi.fn>;
			in: ReturnType<typeof vi.fn>;
			is: ReturnType<typeof vi.fn>;
			order: ReturnType<typeof vi.fn>;
			limit: ReturnType<typeof vi.fn>;
			insert: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
			delete: ReturnType<typeof vi.fn>;
			single: ReturnType<typeof vi.fn>;
			maybeSingle: ReturnType<typeof vi.fn>;
			then: (onFulfilled?: ((value: TableResponse) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>;
			catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>;
		} = {
			select: vi.fn((_sel: string) => builder),
			eq: vi.fn((..._args: unknown[]) => builder),
			gte: vi.fn((..._args: unknown[]) => builder),
			lte: vi.fn((..._args: unknown[]) => builder),
			in: vi.fn((..._args: unknown[]) => builder),
			is: vi.fn((..._args: unknown[]) => builder),
			order: vi.fn((..._args: unknown[]) => builder),
			limit: vi.fn((..._args: unknown[]) => builder),
			insert: vi.fn((..._args: unknown[]) => builder),
			update: vi.fn((..._args: unknown[]) => builder),
			delete: vi.fn((..._args: unknown[]) => builder),
			single: vi.fn(() => ({
				then: (onFulfilled?: ((value: TableResponse) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) =>
					resolveResponseForTable(table).then(onFulfilled as ((v: TableResponse) => unknown) | undefined, onRejected as ((e: unknown) => unknown) | undefined),
				catch: (onRejected?: ((reason: unknown) => unknown) | null) => resolveResponseForTable(table).catch(onRejected as ((e: unknown) => unknown) | undefined),
			})),
			maybeSingle: vi.fn(() => ({
				then: (onFulfilled?: ((value: TableResponse) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) =>
					resolveResponseForTable(table).then(onFulfilled as ((v: TableResponse) => unknown) | undefined, onRejected as ((e: unknown) => unknown) | undefined),
				catch: (onRejected?: ((reason: unknown) => unknown) | null) => resolveResponseForTable(table).catch(onRejected as ((e: unknown) => unknown) | undefined),
			})),
			then: (onFulfilled?: ((value: TableResponse) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) =>
				resolveResponseForTable(table).then(onFulfilled as ((v: TableResponse) => unknown) | undefined, onRejected as ((e: unknown) => unknown) | undefined),
			catch: (onRejected?: ((reason: unknown) => unknown) | null) => resolveResponseForTable(table).catch(onRejected as ((e: unknown) => unknown) | undefined),
		};

		return builder;
	}

	const mockFrom = vi.fn((table: string) => createBuilder(table));
	const debugError = vi.fn();

	return { mockFrom, resetSupabaseState, queueTableResponse, debugError };
});

vi.mock('@/integrations/supabase/client', () => ({
	supabase: {
		from: mockFrom,
	},
}));

vi.mock('@/lib/debug', () => ({
	debug: {
		error: debugError,
	},
}));

import { useThreadGroupeParticipants } from './useThreadGroupeParticipants';

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: 0, gcTime: 0 },
			mutations: { retry: 0 },
		},
	});
}

function createWrapper(queryClient: QueryClient) {
	return function Wrapper(props: { children: React.ReactNode }) {
		return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
	};
}

describe('useThreadGroupeParticipants', () => {
	it('retourne les valeurs par défaut quand thread est null (query disabled)', () => {
		resetSupabaseState();
		const queryClient = createQueryClient();
		const wrapper = createWrapper(queryClient);

		const { result } = renderHook(() => useThreadGroupeParticipants(null), { wrapper });

		expect(result.current).toEqual({
			hasMultipleEtablissementsInGroupe: false,
			groupeNom: null,
			groupeId: null,
			etablissementNames: [],
		});
		expect(mockFrom).not.toHaveBeenCalled();
	});

	it('chargement puis succès: détecte plusieurs établissements dans un même groupe via mapping établissement', async () => {
		resetSupabaseState();

		queueTableResponse('email_messages', {
			data: [
				{
					from_address: 'agent@hopital-a.example.org',
					to_addresses: ['contact@hopital-b.example.org', { email: 'alt@hopital-b.example.org', name: 'Alt' }],
					cc_addresses: [{ email: 'someone@unknown.tld', name: 'X' }],
					bcc_addresses: null,
				},
			],
			error: null,
		});

		queueTableResponse('email_domain_mappings', {
			data: [
				{
					domain: 'hopital-a.example.org',
					etablissement_id: 'etab_a',
					groupe_id: null,
					niveau_mapping: 'etablissement',
					etablissements: { id: 'etab_a', nom: 'Hôpital A' },
					groupes_etablissements: null,
				},
				{
					domain: 'hopital-b.example.org',
					etablissement_id: 'etab_b',
					groupe_id: null,
					niveau_mapping: 'etablissement',
					etablissements: { id: 'etab_b', nom: 'Hôpital B' },
					groupes_etablissements: null,
				},
			],
			error: null,
		});

		queueTableResponse('etablissements_groupes', {
			data: [
				{
					groupe_id: 'g1',
					etablissement_id: 'etab_a',
					date_sortie: null,
					groupes_etablissements: { id: 'g1', nom: 'GHT Nord', type: 'GHT' },
					etablissements: { id: 'etab_a', nom: 'Hôpital A' },
				},
				{
					groupe_id: 'g1',
					etablissement_id: 'etab_b',
					date_sortie: null,
					groupes_etablissements: { id: 'g1', nom: 'GHT Nord', type: 'GHT' },
					etablissements: { id: 'etab_b', nom: 'Hôpital B' },
				},
			],
			error: null,
		});

		const queryClient = createQueryClient();
		const wrapper = createWrapper(queryClient);

		const thread = { id: 't1', messages: [] as Array<unknown> };

		const { result } = renderHook(() => useThreadGroupeParticipants(thread), { wrapper });

		expect(result.current).toEqual({
			hasMultipleEtablissementsInGroupe: false,
			groupeNom: null,
			groupeId: null,
			etablissementNames: [],
		});

		await waitFor(() => {
			expect(result.current.hasMultipleEtablissementsInGroupe).toBe(true);
		});

		expect(result.current).toEqual({
			hasMultipleEtablissementsInGroupe: true,
			groupeNom: 'GHT Nord',
			groupeId: 'g1',
			etablissementNames: ['Hôpital A', 'Hôpital B'],
		});

		expect(mockFrom).toHaveBeenCalledWith('email_messages');
		expect(mockFrom).toHaveBeenCalledWith('email_domain_mappings');
		expect(mockFrom).toHaveBeenCalledWith('etablissements_groupes');
		expect(debugError).not.toHaveBeenCalled();
	});

	it("erreur sur le mapping domaines: logge et retourne le fallback (équivalent métier d'un état erreur)", async () => {
		resetSupabaseState();

		queueTableResponse('email_messages', {
			data: [
				{
					from_address: 'agent@hopital-a.example.org',
					to_addresses: ['contact@hopital-b.example.org'],
					cc_addresses: null,
					bcc_addresses: null,
				},
			],
			error: null,
		});

		queueTableResponse('email_domain_mappings', {
			data: null,
			error: { message: 'x' },
		});

		const queryClient = createQueryClient();
		const wrapper = createWrapper(queryClient);

		const { result } = renderHook(() => useThreadGroupeParticipants({ id: 't2', messages: [] }), { wrapper });

		await waitFor(() => {
			expect(mockFrom).toHaveBeenCalledWith('email_domain_mappings');
		});

		await waitFor(() => {
			expect(result.current).toEqual({
				hasMultipleEtablissementsInGroupe: false,
				groupeNom: null,
				groupeId: null,
				etablissementNames: [],
			});
		});

		expect(debugError).toHaveBeenCalledTimes(1);
		expect(debugError.mock.calls[0]?.[0]).toContain('[GHT Debug] Erreur:');
	});
});