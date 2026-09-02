import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisProductivityScore } from './JarvisProductivityScore';

const { AUTH_STATE, SUPABASE_STATE, mockFrom, debugErrorMock } = vi.hoisted(() => {
	const AUTH_STATE: { user: { id: string; email: string } | null } = {
		user: { id: 'u1', email: 't@t.co' },
	};

	type SupabaseResponse = { data: unknown; error: null | { message: string } };
	const SUPABASE_STATE: { maybeSingleResponse: SupabaseResponse } = {
		maybeSingleResponse: { data: null, error: null },
	};

	const debugErrorMock = vi.fn();

	const makeThenableBuilder = () => {
		const builder: Record<string, unknown> = {};

		const chainMethods = [
			'select',
			'eq',
			'neq',
			'gt',
			'gte',
			'lt',
			'lte',
			'like',
			'ilike',
			'in',
			'contains',
			'containedBy',
			'overlaps',
			'match',
			'order',
			'limit',
			'range',
			'insert',
			'update',
			'upsert',
			'delete',
		] as const;

		for (const m of chainMethods) {
			(builder as Record<string, unknown>)[m] = vi.fn(() => builder);
		}

		(builder as Record<string, unknown>).maybeSingle = vi.fn(async () => SUPABASE_STATE.maybeSingleResponse);
		(builder as Record<string, unknown>).single = vi.fn(async () => SUPABASE_STATE.maybeSingleResponse);

		(builder as Record<string, unknown>).then = (
			onFulfilled?: (v: unknown) => unknown,
			onRejected?: (e: unknown) => unknown
		) => {
			const p = Promise.resolve(SUPABASE_STATE.maybeSingleResponse);
			return p.then(onFulfilled as never, onRejected as never);
		};
		(builder as Record<string, unknown>).catch = (onRejected?: (e: unknown) => unknown) => {
			const p = Promise.resolve(SUPABASE_STATE.maybeSingleResponse);
			return p.catch(onRejected as never);
		};

		return builder;
	};

	const mockFrom = vi.fn(() => makeThenableBuilder());

	return { AUTH_STATE, SUPABASE_STATE, mockFrom, debugErrorMock };
});

vi.mock('@/hooks/shared/useAuth', () => ({
	useAuth: () => ({
		user: AUTH_STATE.user,
		session: AUTH_STATE.user ? { user: AUTH_STATE.user } : null,
		isLoading: false,
	}),
}));

vi.mock('@/integrations/supabase/client', () => ({
	supabase: {
		from: mockFrom,
	},
}));

vi.mock('@/lib/debug', () => ({
	debug: {
		error: debugErrorMock,
		log: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
	},
}));

vi.mock('framer-motion', () => ({
	motion: {
		div: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
	},
}));

vi.mock('lucide-react', () => {
	const Icon = ({ 'data-testid': dataTestId }: { 'data-testid'?: string }) => (
		<span data-testid={dataTestId ?? 'icon'} />
	);

	return {
		Trophy: (p: unknown) => <Icon {...(p as Record<string, unknown>)} data-testid="icon-trophy" />,
		Zap: (p: unknown) => <Icon {...(p as Record<string, unknown>)} data-testid="icon-zap" />,
		CheckCircle2: (p: unknown) => <Icon {...(p as Record<string, unknown>)} data-testid="icon-check" />,
		Mail: (p: unknown) => <Icon {...(p as Record<string, unknown>)} data-testid="icon-mail" />,
		Target: (p: unknown) => <Icon {...(p as Record<string, unknown>)} data-testid="icon-target" />,
		Flame: (p: unknown) => <Icon {...(p as Record<string, unknown>)} data-testid="icon-flame" />,
		Award: (p: unknown) => <Icon {...(p as Record<string, unknown>)} data-testid="icon-award" />,
	};
});

vi.mock('@/lib/utils', () => ({
	cn: (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/badge', () => ({
	Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/card', () => ({
	Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
	CardHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
	CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
	CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/progress', () => ({
	Progress: ({ value }: { value: number }) => <div data-testid="progress" data-value={String(value)} />,
}));

vi.mock('@/components/ui/skeleton', () => ({
	Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" data-class={className ?? ''} />,
}));

vi.mock('@/components/ui/tooltip', () => ({
	TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: 0, gcTime: 0 },
			mutations: { retry: 0 },
		},
	});
}

function renderWithClient(ui: React.ReactElement) {
	const client = createQueryClient();
	return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('JarvisProductivityScore', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		AUTH_STATE.user = { id: 'u1', email: 't@t.co' };
		SUPABASE_STATE.maybeSingleResponse = { data: null, error: null };
	});

	it('affiche le chargement puis le score avec valeurs métier (temps gagné, taux acceptation, badges débloqués)', async () => {
		SUPABASE_STATE.maybeSingleResponse = {
			data: {
				total_score: 350,
				weekly_score: 25,
				level: 3,
				experience_points: 1200,
				time_saved_minutes: 125,
				tasks_auto_completed: 52,
				emails_processed: 100,
				suggestions_accepted: 19,
				suggestions_rejected: 1,
				current_streak_days: 3,
				longest_streak_days: 7,
				badges: [
					{
						id: 'early_adopter',
						name: 'Early Adopter',
						description: 'Premier jour avec Jarvis',
						icon: '🌟',
						earnedAt: '2024-01-01',
					},
					{ id: 'data_master', name: 'Data Master', description: '100 requêtes de données', icon: '📊' },
				],
			},
			error: null,
		};

		renderWithClient(<JarvisProductivityScore />);

		expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

		await waitFor(() => expect(screen.queryByTestId('skeleton')).toBeNull());

		expect(screen.getByText('Votre Score Jarvis')).toBeInTheDocument();
		expect(screen.getByText('350')).toBeInTheDocument();
		expect(screen.getByText('+25 cette semaine')).toBeInTheDocument();
		expect(screen.getByText('Niveau 3')).toBeInTheDocument();

		expect(screen.getByText('2h5')).toBeInTheDocument();
		expect(screen.getByText('52')).toBeInTheDocument();
		expect(screen.getByText('100')).toBeInTheDocument();
		expect(screen.getByText('95%')).toBeInTheDocument();

		expect(screen.getByText('Série actuelle')).toBeInTheDocument();
		expect(screen.getAllByText('3').length).toBeGreaterThan(0);

		const badgeCount = screen.getByRole('heading', { name: /Badges débloqués/i }).parentElement;
		expect(badgeCount).not.toBeNull();
		expect(badgeCount ? screen.getByText('1/8') : null).not.toBeNull();

		expect(mockFrom).toHaveBeenCalledTimes(1);
		expect(mockFrom).toHaveBeenCalledWith('jarvis_user_scores');
	});

	it('fallback sur valeurs par défaut si erreur supabase (et log debug.error)', async () => {
		SUPABASE_STATE.maybeSingleResponse = {
			data: null,
			error: { message: 'x' },
		};

		renderWithClient(<JarvisProductivityScore />);

		expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

		await waitFor(() => expect(screen.queryByTestId('skeleton')).toBeNull());

		expect(screen.getByText('Votre Score Jarvis')).toBeInTheDocument();
		expect(screen.getByText('Niveau 1')).toBeInTheDocument();
		expect(screen.getAllByText('0').length).toBeGreaterThan(0);

		expect(debugErrorMock).toHaveBeenCalledTimes(1);
		expect(String(debugErrorMock.mock.calls[0]?.[0])).toContain('Error fetching score:');
	});

	it("ne lance pas la requête tant que user.id est absent puis la lance quand il arrive", async () => {
		AUTH_STATE.user = null;

		SUPABASE_STATE.maybeSingleResponse = {
			data: {
				total_score: 100,
				weekly_score: 0,
				level: 2,
				experience_points: 0,
				time_saved_minutes: 10,
				tasks_auto_completed: 0,
				emails_processed: 0,
				suggestions_accepted: 0,
				suggestions_rejected: 0,
				current_streak_days: 0,
				longest_streak_days: 0,
				badges: [],
			},
			error: null,
		};

		const client = createQueryClient();
		const { rerender } = render(
			<QueryClientProvider client={client}>
				<JarvisProductivityScore />
			</QueryClientProvider>
		);

		await waitFor(() => expect(mockFrom).not.toHaveBeenCalled());

		AUTH_STATE.user = { id: 'u1', email: 't@t.co' };

		rerender(
			<QueryClientProvider client={client}>
				<JarvisProductivityScore />
			</QueryClientProvider>
		);

		await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument());
	});
});