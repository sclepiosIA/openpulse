/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */

import { type PropsWithChildren } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
	TOAST_CALLS,
	mockToastHook,
	mockInvoke,
	mockSanitize,
	mockDebugError,
} = vi.hoisted(() => {
	const TOAST_CALLS: Array<{ title?: string; description?: string; variant?: string }> = [];

	const mockToastFn = vi.fn((payload: { title?: string; description?: string; variant?: string }) => {
		TOAST_CALLS.push(payload);
	});

	const mockToastHook = vi.fn(() => ({ toast: mockToastFn }));

	const mockInvoke = vi.fn<
		(args: string, options: { body: { content: string; action: string; target_language?: string } }) => Promise<{
			data: unknown;
			error: null | { message: string };
		}>
	>();

	const mockSanitize = vi.fn((err: unknown) => {
		if (typeof err === 'object' && err !== null && 'message' in err) {
			const msg = (err as { message?: unknown }).message;
			return typeof msg === 'string' ? msg : 'sanitized';
		}
		return 'sanitized';
	});

	const mockDebugError = vi.fn();

	return {
		TOAST_CALLS,
		mockToastHook,
		mockInvoke,
		mockSanitize,
		mockDebugError,
	};
});

vi.mock('@/integrations/supabase/client', () => ({
	supabase: {
		functions: {
			invoke: mockInvoke,
		},
	},
}));

vi.mock('@/hooks/shared/use-toast', () => ({
	useToast: mockToastHook,
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
	sanitizeSupabaseError: mockSanitize,
}));

vi.mock('@/lib/debug', () => ({
	debug: {
		error: mockDebugError,
	},
}));

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: 0, gcTime: 0 },
			mutations: { retry: 0 },
		},
	});

	return function Wrapper({ children }: PropsWithChildren) {
		return QueryClientProvider({ client: queryClient, children });
	};
}

describe('usePulseAIEditor', () => {
	it('état initial: isProcessing=false et ne traite pas un contenu vide', async () => {
		const { usePulseAIEditor } = await import('./usePulseAIEditor');

		mockInvoke.mockReset();
		TOAST_CALLS.splice(0, TOAST_CALLS.length);

		const { result } = renderHook(() => usePulseAIEditor(), { wrapper: createWrapper() });

		expect(result.current.isProcessing).toBe(false);

		let returned: string | null = 'not-null';
		await act(async () => {
			returned = await result.current.improve('   ');
		});

		expect(returned).toBeNull();
		expect(mockInvoke).not.toHaveBeenCalled();
		expect(result.current.isProcessing).toBe(false);
		expect(TOAST_CALLS.length).toBe(0);
	});

	it('succès: improve appelle la function supabase avec le bon body et retourne le résultat (et bascule isProcessing)', async () => {
		const { usePulseAIEditor } = await import('./usePulseAIEditor');

		mockInvoke.mockReset();
		TOAST_CALLS.splice(0, TOAST_CALLS.length);

		mockInvoke.mockResolvedValueOnce({
			data: { result: 'Texte amélioré', action: 'improve', original: 'x' },
			error: null,
		});

		const { result } = renderHook(() => usePulseAIEditor(), { wrapper: createWrapper() });

		let promise: Promise<string | null> | null = null;
		act(() => {
			promise = result.current.improve('Bonjour');
		});

		expect(result.current.isProcessing).toBe(true);

		let out: string | null = null;
		await act(async () => {
			out = await promise;
		});

		expect(mockInvoke).toHaveBeenCalledTimes(1);
		expect(mockInvoke).toHaveBeenCalledWith('pulse-ai-editor', {
			body: {
				content: 'Bonjour',
				action: 'improve',
				target_language: undefined,
			},
		});
		expect(out).toBe('Texte amélioré');

		await waitFor(() => {
			expect(result.current.isProcessing).toBe(false);
		});

		expect(TOAST_CALLS.length).toBe(0);
	});

	it('succès: translate utilise la langue par défaut et la passe en target_language', async () => {
		const { usePulseAIEditor } = await import('./usePulseAIEditor');

		mockInvoke.mockReset();
		TOAST_CALLS.splice(0, TOAST_CALLS.length);

		mockInvoke.mockResolvedValueOnce({
			data: { result: 'Hello', action: 'translate', original: 'Bonjour' },
			error: null,
		});

		const { result } = renderHook(() => usePulseAIEditor(), { wrapper: createWrapper() });

		let out: string | null = null;
		await act(async () => {
			out = await result.current.translate('Bonjour');
		});

		expect(mockInvoke).toHaveBeenCalledTimes(1);
		expect(mockInvoke).toHaveBeenCalledWith('pulse-ai-editor', {
			body: {
				content: 'Bonjour',
				action: 'translate',
				target_language: 'anglais',
			},
		});
		expect(out).toBe('Hello');

		await waitFor(() => {
			expect(result.current.isProcessing).toBe(false);
		});
		expect(TOAST_CALLS.length).toBe(0);
	});

	it("erreur: si supabase renvoie error, retourne null, log et affiche un toast destructif (et reset isProcessing)", async () => {
		const { usePulseAIEditor } = await import('./usePulseAIEditor');

		mockInvoke.mockReset();
		mockDebugError.mockReset();
		mockSanitize.mockClear();
		TOAST_CALLS.splice(0, TOAST_CALLS.length);

		mockInvoke.mockResolvedValueOnce({
			data: null,
			error: { message: 'x' },
		});

		const { result } = renderHook(() => usePulseAIEditor(), { wrapper: createWrapper() });

		let promise: Promise<string | null> | null = null;
		act(() => {
			promise = result.current.reformulate('Salut');
		});

		expect(result.current.isProcessing).toBe(true);

		let out: string | null = 'not-null';
		await act(async () => {
			out = await promise;
		});

		expect(out).toBeNull();

		expect(mockInvoke).toHaveBeenCalledTimes(1);
		expect(mockInvoke).toHaveBeenCalledWith('pulse-ai-editor', {
			body: {
				content: 'Salut',
				action: 'reformulate',
				target_language: undefined,
			},
		});

		expect(mockDebugError).toHaveBeenCalledTimes(1);
		expect(mockSanitize).toHaveBeenCalledTimes(1);

		expect(TOAST_CALLS.length).toBe(1);
		expect(TOAST_CALLS[0]?.title).toBe('Erreur IA');
		expect(TOAST_CALLS[0]?.description).toBe('x');
		expect(TOAST_CALLS[0]?.variant).toBe('destructive');

		await waitFor(() => {
			expect(result.current.isProcessing).toBe(false);
		});
	});
});