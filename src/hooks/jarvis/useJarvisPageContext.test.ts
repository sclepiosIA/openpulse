/// <reference types="vitest" />
// @vitest-environment jsdom

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
	ETAB_ID,
	CONTACT_ID,
	ETABLISSEMENT_ROW,
	CONTACT_ROW,
	ETABLISSEMENT_FOR_CONTACT_ROW,
	PROFILE_COMMERCIAL,
	PROFILE_CHEF_PROJET,
	PROFILE_CSM,
	mockUseLocation,
	mockUseParams,
	mockFrom,
	tableData,
	setTableData,
	setFromImpl,
	resetFromImpl,
} = vi.hoisted(() => {
	const ETAB_ID = '11111111-1111-1111-1111-111111111111';
	const CONTACT_ID = '22222222-2222-2222-2222-222222222222';

	const ETABLISSEMENT_ROW = {
		id: ETAB_ID,
		nom: 'Clinique Alpha',
		ville: 'Lyon',
		statut: 'active',
		commercial_id: 'c1',
		chef_projet_id: 'cp1',
		csm_id: 'csm1',
	};

	const CONTACT_ROW = {
		id: CONTACT_ID,
		prenom: 'Ada',
		nom: 'Lovelace',
		email: 'ada@example.test',
		fonction: 'DSI',
		etablissement_id: ETAB_ID,
	};

	const ETABLISSEMENT_FOR_CONTACT_ROW = { id: ETAB_ID, nom: 'Clinique Alpha' };

	const PROFILE_COMMERCIAL = { id: 'c1', prenom: 'Cam', nom: 'Commercial' };
	const PROFILE_CHEF_PROJET = { id: 'cp1', prenom: 'Chris', nom: 'Chef' };
	const PROFILE_CSM = { id: 'csm1', prenom: 'Casey', nom: 'CSM' };

	const mockUseLocation = vi.fn();
	const mockUseParams = vi.fn();

	type TableName =
		| 'etablissements'
		| 'profiles'
		| 'contacts'
		| 'groupes_etablissements'
		| 'partenaires'
		| 'candidates'
		| string;

	const tableData = new Map<string, unknown | null>();

	const setTableData = (table: TableName, id: string, data: unknown | null) => {
		tableData.set(`${table}:${id}`, data);
	};

	type BuilderState = {
		table: TableName;
		selected: string | null;
		filters: { op: string; column: string; value: unknown }[];
	};

	const makeBuilder = (state: BuilderState, resolveResult: () => Promise<{ data: unknown | null; error: { message: string } | null }>) => {
		const builder: Record<string, unknown> = {};

		const chain = (methodName: string) =>
			vi.fn((...args: unknown[]) => {
				if (methodName === 'select') state.selected = String(args[0] ?? '');
				if (methodName === 'eq') state.filters.push({ op: 'eq', column: String(args[0]), value: args[1] });
				return builder;
			});

		builder.select = chain('select');
		builder.eq = chain('eq');
		builder.gte = chain('gte');
		builder.lte = chain('lte');
		builder.in = chain('in');
		builder.order = chain('order');
		builder.limit = chain('limit');
		builder.insert = chain('insert');
		builder.update = chain('update');
		builder.delete = chain('delete');

		builder.single = vi.fn(async () => resolveResult());
		builder.maybeSingle = vi.fn(async () => resolveResult());

		builder.then = vi.fn((onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
			return resolveResult().then(onFulfilled, onRejected);
		});
		builder.catch = vi.fn((onRejected?: (e: unknown) => unknown) => {
			return resolveResult().catch(onRejected);
		});

		return builder;
	};

	type FromImpl = (table: TableName) => unknown;
	let fromImpl: FromImpl | null = null;

	const setFromImpl = (impl: FromImpl) => {
		fromImpl = impl;
	};

	const resetFromImpl = () => {
		fromImpl = null;
	};

	const mockFrom = vi.fn((table: TableName) => {
		if (fromImpl) return fromImpl(table);

		const state: BuilderState = {
			table,
			selected: null,
			filters: [],
		};

		const resolveResult = async (): Promise<{ data: unknown | null; error: { message: string } | null }> => {
			const eqFilter = state.filters.find((f) => f.op === 'eq' && f.column === 'id');
			const id = typeof eqFilter?.value === 'string' ? (eqFilter.value as string) : '';
			const data = tableData.has(`${state.table}:${id}`) ? tableData.get(`${state.table}:${id}`) : null;
			return { data: (data ?? null) as unknown | null, error: null };
		};

		return makeBuilder(state, resolveResult);
	});

	return {
		ETAB_ID,
		CONTACT_ID,
		ETABLISSEMENT_ROW,
		CONTACT_ROW,
		ETABLISSEMENT_FOR_CONTACT_ROW,
		PROFILE_COMMERCIAL,
		PROFILE_CHEF_PROJET,
		PROFILE_CSM,
		mockUseLocation,
		mockUseParams,
		mockFrom,
		tableData,
		setTableData,
		setFromImpl,
		resetFromImpl,
	};
});

vi.mock('react-router-dom', () => ({
	useLocation: () => mockUseLocation(),
	useParams: () => mockUseParams(),
}));

vi.mock('@/integrations/supabase/client', () => ({
	supabase: {
		from: mockFrom,
	},
}));

import { useJarvisHasEntityContext, useJarvisPageContext } from './useJarvisPageContext';

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: 0, gcTime: 0 },
			mutations: { retry: 0 },
		},
	});

	const Wrapper = ({ children }: { children: React.ReactNode }) =>
		React.createElement(QueryClientProvider, { client: queryClient }, children);

	return { Wrapper, queryClient };
}

describe('useJarvisPageContext', () => {
	it('chargement -> succès (établissement) et construit un contexte détaillé', async () => {
		resetFromImpl();
		tableData.clear();

		setTableData('etablissements', ETAB_ID, ETABLISSEMENT_ROW);
		setTableData('profiles', 'c1', PROFILE_COMMERCIAL);
		setTableData('profiles', 'cp1', PROFILE_CHEF_PROJET);
		setTableData('profiles', 'csm1', PROFILE_CSM);

		mockUseLocation.mockReturnValue({
			pathname: `/etablissements/${ETAB_ID}`,
			search: '?statut=active&_t=123',
			hash: '',
			state: null,
			key: 'k1',
		});
		mockUseParams.mockReturnValue({ id: ETAB_ID });

		const { Wrapper } = createWrapper();
		const { result } = renderHook(() => useJarvisPageContext(), { wrapper: Wrapper });

		await waitFor(() => {
			expect(result.current.pageType).toBe('etablissement');
			expect(result.current.module).toBe('crm');
		});

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.fullPath).toBe(`/etablissements/${ETAB_ID}?statut=active&_t=123`);

		expect(result.current.primaryEntity).not.toBeNull();
		expect(result.current.primaryEntity?.type).toBe('etablissement');
		expect(result.current.primaryEntity?.id).toBe(ETAB_ID);
		expect(result.current.primaryEntity?.name).toBe('Clinique Alpha');

		const meta = result.current.primaryEntity?.metadata as Record<string, unknown>;
		expect(meta.ville).toBe('Lyon');
		expect(meta.statut).toBe('active');
		expect(meta.commercial).toEqual(PROFILE_COMMERCIAL);
		expect(meta.chef_projet).toEqual(PROFILE_CHEF_PROJET);
		expect(meta.csm).toEqual(PROFILE_CSM);

		expect(result.current.query).toEqual({ statut: 'active', _t: '123' });
		expect(result.current.contextText).toContain('PAGE ACTUELLE: CRM');
		expect(result.current.contextText).toContain(`URL: /etablissements/${ETAB_ID}`);
		expect(result.current.contextText).toContain('ENTITÉ EN COURS DE VISUALISATION:');
		expect(result.current.contextText).toContain('- Type: etablissement');
		expect(result.current.contextText).toContain('- Nom: Clinique Alpha');
		expect(result.current.contextText).toContain(`- ID: ${ETAB_ID}`);
		expect(result.current.contextText).toContain('- Ville: Lyon');
		expect(result.current.contextText).toContain('- Statut: active');
		expect(result.current.contextText).toContain('- Commercial: Cam Commercial');
		expect(result.current.contextText).toContain('- Chef de projet: Chris Chef');
		expect(result.current.contextText).toContain('- CSM: Casey CSM');

		expect(result.current.contextText).toContain('FILTRES/PARAMÈTRES:');
		expect(result.current.contextText).toContain('- statut: active');
		expect(result.current.contextText).not.toContain('- _t: 123');

		expect(mockFrom).toHaveBeenCalledWith('etablissements');
		expect(mockFrom).toHaveBeenCalledWith('profiles');
	});

	it('succès (contact) inclut l’établissement lié dans le contexte', async () => {
		resetFromImpl();
		tableData.clear();

		setTableData('contacts', CONTACT_ID, CONTACT_ROW);
		setTableData('etablissements', ETAB_ID, ETABLISSEMENT_FOR_CONTACT_ROW);

		mockUseLocation.mockReturnValue({
			pathname: `/contacts/${CONTACT_ID}`,
			search: '?q=ada&timestamp=1',
			hash: '',
			state: null,
			key: 'k2',
		});
		mockUseParams.mockReturnValue({ id: CONTACT_ID });

		const { Wrapper } = createWrapper();
		const { result } = renderHook(() => useJarvisPageContext(), { wrapper: Wrapper });

		await waitFor(() => {
			expect(result.current.pageType).toBe('contact');
			expect(result.current.module).toBe('crm');
		});

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.primaryEntity).not.toBeNull();
		expect(result.current.primaryEntity?.type).toBe('contact');
		expect(result.current.primaryEntity?.id).toBe(CONTACT_ID);
		expect(result.current.primaryEntity?.name).toBe('Ada Lovelace');

		const meta = result.current.primaryEntity?.metadata as Record<string, unknown>;
		expect(meta.email).toBe('ada@example.test');
		expect(meta.fonction).toBe('DSI');
		expect(meta.etablissement).toEqual(ETABLISSEMENT_FOR_CONTACT_ROW);

		expect(result.current.query).toEqual({ q: 'ada', timestamp: '1' });
		expect(result.current.contextText).toContain('PAGE ACTUELLE: CRM');
		expect(result.current.contextText).toContain('- Type: contact');
		expect(result.current.contextText).toContain('- Nom: Ada Lovelace');
		expect(result.current.contextText).toContain('- Email: ada@example.test');
		expect(result.current.contextText).toContain('- Fonction: DSI');
		expect(result.current.contextText).toContain('- Établissement: Clinique Alpha');
		expect(result.current.contextText).toContain('FILTRES/PARAMÈTRES:');
		expect(result.current.contextText).toContain('- q: ada');
		expect(result.current.contextText).not.toContain('- timestamp: 1');

		expect(mockFrom).toHaveBeenCalledWith('contacts');
		expect(mockFrom).toHaveBeenCalledWith('etablissements');
	});

	it('erreur supabase => isLoading false, pas d’entité, et useJarvisHasEntityContext renvoie false', async () => {
		tableData.clear();
		resetFromImpl();

		setFromImpl((table: string) => {
			const state = {
				table,
				selected: null as string | null,
				filters: [] as { op: string; column: string; value: unknown }[],
			};

			const builder: Record<string, unknown> = {};

			const chain = (methodName: string) =>
				vi.fn((...args: unknown[]) => {
					if (methodName === 'select') state.selected = String(args[0] ?? '');
					if (methodName === 'eq') state.filters.push({ op: 'eq', column: String(args[0]), value: args[1] });
					return builder;
				});

			builder.select = chain('select');
			builder.eq = chain('eq');
			builder.gte = chain('gte');
			builder.lte = chain('lte');
			builder.in = chain('in');
			builder.order = chain('order');
			builder.limit = chain('limit');
			builder.insert = chain('insert');
			builder.update = chain('update');
			builder.delete = chain('delete');

			const result = async (): Promise<{ data: null; error: { message: string } }> => ({ data: null, error: { message: 'x' } });

			builder.maybeSingle = vi.fn(async () => result());
			builder.single = vi.fn(async () => result());
			builder.then = vi.fn((onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
				return result().then(onFulfilled, onRejected);
			});
			builder.catch = vi.fn((onRejected?: (e: unknown) => unknown) => {
				return result().catch(onRejected);
			});

			return builder;
		});

		mockUseLocation.mockReturnValue({
			pathname: `/etablissements/${ETAB_ID}`,
			search: '',
			hash: '',
			state: null,
			key: 'k3',
		});
		mockUseParams.mockReturnValue({ id: ETAB_ID });

		const { Wrapper } = createWrapper();
		const { result: ctxResult } = renderHook(() => useJarvisPageContext(), { wrapper: Wrapper });
		const { result: hasEntityResult } = renderHook(() => useJarvisHasEntityContext(), { wrapper: Wrapper });

		await waitFor(() => {
			expect(ctxResult.current.pageType).toBe('etablissement');
			expect(ctxResult.current.module).toBe('crm');
		});

		await waitFor(() => {
			expect(ctxResult.current.isLoading).toBe(false);
		});

		expect(ctxResult.current.primaryEntity).toBeNull();
		expect(ctxResult.current.contextText).toContain('Module crm: Aucune entité spécifique sélectionnée (vue liste)');
		expect(hasEntityResult.current).toBe(false);

		expect(mockFrom).toHaveBeenCalledWith('etablissements');
	});
});