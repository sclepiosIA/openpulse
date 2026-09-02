import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import type { PropsWithChildren, ReactNode } from 'react'

const { STABLE_ERROR_OBJ, STABLE_ERROR_OBJ_WITH_DETAILS, STABLE_ERROR_OBJ_WITH_CODE, UNKNOWN_OBJ_WITH_MESSAGE } =
	vi.hoisted(() => ({
		STABLE_ERROR_OBJ: { message: 'msg-obj' },
		STABLE_ERROR_OBJ_WITH_DETAILS: { message: 'msg-det', details: 'detail-1' },
		STABLE_ERROR_OBJ_WITH_CODE: { message: 'msg-code', code: 'c1' },
		UNKNOWN_OBJ_WITH_MESSAGE: { message: 123 },
	}))

function createWrapper(): { Wrapper: (props: { children: ReactNode }) => ReactNode; queryClient: QueryClient } {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: 0, gcTime: 0 },
			mutations: { retry: 0 },
		},
	})

	const Wrapper = ({ children }: PropsWithChildren) =>
		QueryClientProvider({ client: queryClient, children }) as unknown as ReactNode

	return { Wrapper, queryClient }
}

import {
	getErrorMessage,
	getErrorCode,
	getErrorDetails,
	type SupabaseError,
	type MutationError,
	type ContratInsertData,
} from './error-types'

describe('error-types.ts', () => {
	describe('getErrorMessage', () => {
		it('returns message for Error instance', () => {
			const err = new Error('boom')
			expect(getErrorMessage(err)).toBe('boom')
		})

		it('returns message for object with message field (stringified)', () => {
			expect(getErrorMessage(STABLE_ERROR_OBJ)).toBe('msg-obj')
			expect(getErrorMessage(UNKNOWN_OBJ_WITH_MESSAGE)).toBe('123')
		})

		it('returns string when error is a string', () => {
			expect(getErrorMessage('oops')).toBe('oops')
		})

		it('returns fallback for unknown', () => {
			expect(getErrorMessage(null)).toBe('Erreur inconnue')
			expect(getErrorMessage(undefined)).toBe('Erreur inconnue')
			expect(getErrorMessage(42)).toBe('Erreur inconnue')
			expect(getErrorMessage({})).toBe('Erreur inconnue')
		})

		it('integration with react-query query: loading -> success', async () => {
			const { Wrapper } = createWrapper()

			const { result } = renderHook(
				() =>
					useQuery({
						queryKey: ['ok-msg'],
						queryFn: async () => 'done',
					}),
				{ wrapper: Wrapper }
			)

			expect(result.current.isLoading).toBe(true)

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true)
			})

			expect(result.current.data).toBe('done')
			expect(getErrorMessage(result.current.error)).toBe('Erreur inconnue')
		})

		it('integration with react-query query: loading -> error (Supabase-like error object)', async () => {
			const { Wrapper } = createWrapper()

			const { result } = renderHook(
				() =>
					useQuery({
						queryKey: ['err-msg'],
						queryFn: async () => {
							throw STABLE_ERROR_OBJ
						},
					}),
				{ wrapper: Wrapper }
			)

			expect(result.current.isLoading).toBe(true)

			await waitFor(() => {
				expect(result.current.isError).toBe(true)
			})

			expect(getErrorMessage(result.current.error)).toBe('msg-obj')
		})

		it('integration with react-query mutation: success then error; asserts call payload', async () => {
			const { Wrapper } = createWrapper()

			const mutateFn = vi.fn(async (payload: { value: string }) => ({ ok: true, payload }))

			const { result } = renderHook(
				() =>
					useMutation({
						mutationFn: mutateFn,
					}),
				{ wrapper: Wrapper }
			)

			await act(async () => {
				await result.current.mutateAsync({ value: 'v1' })
			})

			expect(mutateFn).toHaveBeenCalledTimes(1)
			expect(mutateFn).toHaveBeenCalledWith({ value: 'v1' })

			const mutateFailFn = vi.fn(async () => {
				throw STABLE_ERROR_OBJ
			})

			const { result: resultFail } = renderHook(
				() =>
					useMutation({
						mutationFn: mutateFailFn,
					}),
				{ wrapper: Wrapper }
			)

			await act(async () => {
				try {
					await resultFail.current.mutateAsync({ value: 'v2' })
				} catch {
					// ignore
				}
			})

			expect(mutateFailFn).toHaveBeenCalledTimes(1)

			await waitFor(() => {
				expect(resultFail.current.isError).toBe(true)
			})

			expect(getErrorMessage(resultFail.current.error)).toBe('msg-obj')
		})
	})

	describe('getErrorCode', () => {
		it('returns code when present and stringifies it', () => {
			expect(getErrorCode(STABLE_ERROR_OBJ_WITH_CODE)).toBe('c1')
			expect(getErrorCode({ code: 99 })).toBe('99')
		})

		it('returns undefined when absent or not object', () => {
			expect(getErrorCode(STABLE_ERROR_OBJ)).toBeUndefined()
			expect(getErrorCode(new Error('x'))).toBeUndefined()
			expect(getErrorCode('x')).toBeUndefined()
			expect(getErrorCode(null)).toBeUndefined()
		})

		it('integration with react-query query: error contains code', async () => {
			const { Wrapper } = createWrapper()

			const { result } = renderHook(
				() =>
					useQuery({
						queryKey: ['err-code'],
						queryFn: async () => {
							throw STABLE_ERROR_OBJ_WITH_CODE
						},
					}),
				{ wrapper: Wrapper }
			)

			expect(result.current.isLoading).toBe(true)

			await waitFor(() => {
				expect(result.current.isError).toBe(true)
			})

			expect(getErrorCode(result.current.error)).toBe('c1')
		})
	})

	describe('getErrorDetails', () => {
		it('returns details when present and stringifies it', () => {
			expect(getErrorDetails(STABLE_ERROR_OBJ_WITH_DETAILS)).toBe('detail-1')
			expect(getErrorDetails({ details: { a: 1 } })).toBe('[object Object]')
		})

		it('returns undefined when absent or not object', () => {
			expect(getErrorDetails(STABLE_ERROR_OBJ)).toBeUndefined()
			expect(getErrorDetails(new Error('x'))).toBeUndefined()
			expect(getErrorDetails('x')).toBeUndefined()
			expect(getErrorDetails(null)).toBeUndefined()
		})

		it('integration with react-query query: error contains details', async () => {
			const { Wrapper } = createWrapper()

			const { result } = renderHook(
				() =>
					useQuery({
						queryKey: ['err-details'],
						queryFn: async () => {
							throw STABLE_ERROR_OBJ_WITH_DETAILS
						},
					}),
				{ wrapper: Wrapper }
			)

			expect(result.current.isLoading).toBe(true)

			await waitFor(() => {
				expect(result.current.isError).toBe(true)
			})

			expect(getErrorDetails(result.current.error)).toBe('detail-1')
		})
	})

	describe('types compile checks', () => {
		it('allows MutationError and ContratInsertData required fields', () => {
			const e1: MutationError = new Error('x')
			const e2: MutationError = STABLE_ERROR_OBJ as SupabaseError

			expect(getErrorMessage(e1)).toBe('x')
			expect(getErrorMessage(e2)).toBe('msg-obj')

			const payload: ContratInsertData = {
				clauses_selectionnees: ['c1'],
				tags: [],
				metadata: { k: 'v' },
				titre: 't',
				montant_annuel: 10,
				created_by: 'u1',
			}

			expect(payload.clauses_selectionnees).toEqual(['c1'])
			expect(payload.metadata).toEqual({ k: 'v' })
		})
	})
})