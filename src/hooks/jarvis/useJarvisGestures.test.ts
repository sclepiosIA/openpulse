/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */

import React, { createRef } from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisGestures } from './useJarvisGestures';

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: 0, gcTime: 0 },
			mutations: { retry: 0 },
		},
	});
}

function createWrapper() {
	const queryClient = createQueryClient();
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return React.createElement(QueryClientProvider, { client: queryClient }, children);
	};
}

function createContainer() {
	const div = document.createElement('div');
	div.style.width = '300px';
	div.style.height = '300px';
	document.body.appendChild(div);
	return div;
}

function createTouchList(touches: Array<{ clientX: number; clientY: number }>): TouchList {
	const arr = touches.map((t, i) => {
		return {
			identifier: i,
			target: document.body,
			clientX: t.clientX,
			clientY: t.clientY,
			screenX: t.clientX,
			screenY: t.clientY,
			pageX: t.clientX,
			pageY: t.clientY,
			radiusX: 1,
			radiusY: 1,
			rotationAngle: 0,
			force: 1,
		} as unknown as Touch;
	});

	const touchList = {
		length: arr.length,
		item: (index: number) => arr[index] ?? null,
		...Object.fromEntries(arr.map((t, i) => [String(i), t])),
	} as unknown as TouchList;

	return touchList;
}

describe('useJarvisGestures', () => {
	it('chargement initial -> valeurs par défaut, puis swipe-left déclenche next-agent et historise', () => {
		const container = createContainer();
		const containerRef = createRef<HTMLElement>();
		containerRef.current = container;

		const onAgentChange = vi.fn<(agent: string) => void>();
		const onRefresh = vi.fn<() => void>();
		const onQuickAction = vi.fn<() => void>();

		const wrapper = createWrapper();

		const { result } = renderHook(
			() =>
				useJarvisGestures({
					containerRef,
					enabledAgents: ['sophia', 'marcus', 'olivia'],
					currentAgent: 'marcus',
					onAgentChange,
					onRefresh,
					onQuickAction,
					swipeThreshold: 50,
					longPressThreshold: 500,
				}),
			{ wrapper }
		);

		expect(result.current.isEnabled).toBe(true);
		expect(result.current.activeGesture).toBeNull();
		expect(result.current.swipeDistance).toEqual({ x: 0, y: 0 });
		expect(result.current.longPressProgress).toBe(0);
		expect(result.current.gestureHistory).toEqual([]);

		act(() => {
			container.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
		});

		act(() => {
			container.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 100, bubbles: true }));
		});

		expect(result.current.activeGesture).toBe('swipe-left');
		expect(result.current.swipeDistance).toEqual({ x: -80, y: 0 });

		act(() => {
			container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		});

		expect(onAgentChange).toHaveBeenCalledTimes(1);
		expect(onAgentChange).toHaveBeenCalledWith('olivia');
		expect(onRefresh).not.toHaveBeenCalled();
		expect(onQuickAction).not.toHaveBeenCalled();

		expect(result.current.activeGesture).toBeNull();
		expect(result.current.swipeDistance).toEqual({ x: 0, y: 0 });
		expect(result.current.longPressProgress).toBe(0);

		expect(result.current.gestureHistory.length).toBe(1);
		expect(result.current.gestureHistory[0]).toEqual({
			gesture: 'swipe-left',
			action: 'next-agent',
			params: { agent: 'olivia' },
		});
	});

	it('erreur/annulation : désactivé => aucun geste pris en compte (aucun callback, aucun historique)', () => {
		const container = createContainer();
		const containerRef = createRef<HTMLElement>();
		containerRef.current = container;

		const onAgentChange = vi.fn<(agent: string) => void>();
		const onRefresh = vi.fn<() => void>();
		const onQuickAction = vi.fn<() => void>();

		const wrapper = createWrapper();

		const { result } = renderHook(
			() =>
				useJarvisGestures({
					containerRef,
					enabledAgents: ['sophia', 'marcus'],
					currentAgent: 'sophia',
					onAgentChange,
					onRefresh,
					onQuickAction,
					swipeThreshold: 30,
					longPressThreshold: 200,
				}),
			{ wrapper }
		);

		act(() => {
			result.current.setEnabled(false);
		});

		expect(result.current.isEnabled).toBe(false);

		act(() => {
			container.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true }));
			container.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 10, bubbles: true }));
			container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		});

		expect(result.current.activeGesture).toBeNull();
		expect(result.current.swipeDistance).toEqual({ x: 0, y: 0 });
		expect(result.current.longPressProgress).toBe(0);
		expect(result.current.gestureHistory).toEqual([]);

		expect(onAgentChange).not.toHaveBeenCalled();
		expect(onRefresh).not.toHaveBeenCalled();
		expect(onQuickAction).not.toHaveBeenCalled();
	});

	it('long-press déclenche quick-action + progression puis pinch-out déclenche zoom-in et historise', () => {
		vi.useFakeTimers();

		const container = createContainer();
		const containerRef = createRef<HTMLElement>();
		containerRef.current = container;

		const onQuickAction = vi.fn<() => void>();
		const onZoomIn = vi.fn<() => void>();
		const onZoomOut = vi.fn<() => void>();

		const wrapper = createWrapper();

		const { result } = renderHook(
			() =>
				useJarvisGestures({
					containerRef,
					enabledAgents: ['sophia', 'marcus'],
					currentAgent: 'sophia',
					onQuickAction,
					onZoomIn,
					onZoomOut,
					longPressThreshold: 200,
				}),
			{ wrapper }
		);

		act(() => {
			container.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }));
		});

		act(() => {
			vi.advanceTimersByTime(100);
		});

		expect(result.current.longPressProgress).toBeGreaterThan(0);
		expect(result.current.longPressProgress).toBeLessThanOrEqual(1);
		expect(onQuickAction).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(120);
		});

		expect(onQuickAction).toHaveBeenCalledTimes(1);
		expect(result.current.activeGesture).toBe('long-press');
		expect(result.current.gestureHistory[0]).toEqual({
			gesture: 'long-press',
			action: 'quick-action',
			params: undefined,
		});

		act(() => {
			container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		});

		expect(result.current.activeGesture).toBeNull();
		expect(result.current.longPressProgress).toBe(0);

		const tStart = createTouchList([
			{ clientX: 0, clientY: 0 },
			{ clientX: 100, clientY: 0 },
		]);
		const touchStartEvent = new Event('touchstart', { bubbles: true, cancelable: true }) as TouchEvent;
		Object.defineProperty(touchStartEvent, 'touches', { value: tStart });

		act(() => {
			container.dispatchEvent(touchStartEvent);
		});

		const tMove = createTouchList([
			{ clientX: 0, clientY: 0 },
			{ clientX: 140, clientY: 0 },
		]);
		const touchMoveEvent = new Event('touchmove', { bubbles: true, cancelable: true }) as TouchEvent;
		Object.defineProperty(touchMoveEvent, 'touches', { value: tMove });

		act(() => {
			container.dispatchEvent(touchMoveEvent);
		});

		expect(onZoomIn).toHaveBeenCalledTimes(1);
		expect(onZoomOut).not.toHaveBeenCalled();
		expect(result.current.activeGesture).toBe('pinch-out');

		expect(result.current.gestureHistory[0]).toEqual({
			gesture: 'pinch-out',
			action: 'zoom-in',
			params: undefined,
		});

		vi.useRealTimers();
	});
});