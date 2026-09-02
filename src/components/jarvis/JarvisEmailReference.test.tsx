import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { navigateMock, hoverCardPropsMock, windowDispatchSpy } = vi.hoisted(() => {
	const navigateMockFn = vi.fn();
	const hoverCardPropsFn = vi.fn();
	return {
		navigateMock: navigateMockFn,
		hoverCardPropsMock: hoverCardPropsFn,
		windowDispatchSpy: vi.spyOn(window, 'dispatchEvent'),
	};
});

vi.mock('react-router-dom', () => ({
	useNavigate: () => navigateMock,
}));

vi.mock('lucide-react', () => {
	const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
	return { Mail: Icon, ArrowRight: Icon };
});

vi.mock('framer-motion', () => {
	return {
		motion: {
			button: ({
				children,
				onClick,
				className,
				whileHover: _whileHover,
				whileTap: _whileTap,
				transition: _transition,
				...rest
			}: React.PropsWithChildren<
				React.ButtonHTMLAttributes<HTMLButtonElement> & {
					whileHover?: unknown;
					whileTap?: unknown;
					transition?: unknown;
				}
			>) => (
				<button type="button" onClick={onClick} className={className} {...rest}>
					{children}
				</button>
			),
		},
	};
});

vi.mock('@/lib/utils', () => ({
	cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/search/AIEmailHoverCard', () => ({
	AIEmailHoverCard: ({ children, threadId }: { children: React.ReactNode; threadId: string }) => {
		hoverCardPropsMock({ threadId });
		return <div data-testid="ai-email-hovercard">{children}</div>;
	},
}));

import { JarvisEmailReference } from './JarvisEmailReference';

function createWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
	});
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	};
}

describe('JarvisEmailReference', () => {
	it('affiche le titre, passe threadId au hovercard, et navigue en dispatchant jarvis:close au click', () => {
		const Wrapper = createWrapper();

		render(<JarvisEmailReference threadId="th_1" title="Email: Bienvenue" className="extra-class" />, {
			wrapper: Wrapper,
		});

		expect(screen.getByText('Email: Bienvenue')).toBeTruthy();

		expect(hoverCardPropsMock).toHaveBeenCalledTimes(1);
		expect(hoverCardPropsMock).toHaveBeenCalledWith({ threadId: 'th_1' });

		const btn = screen.getByRole('button', { name: /email: bienvenue/i });
		expect(btn.className.includes('extra-class')).toBe(true);

		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		const preventDefault = vi.spyOn(event, 'preventDefault');
		const stopPropagation = vi.spyOn(event, 'stopPropagation');

		fireEvent(btn, event);

		expect(preventDefault).toHaveBeenCalledTimes(1);
		expect(stopPropagation).toHaveBeenCalledTimes(1);

		expect(windowDispatchSpy).toHaveBeenCalledTimes(1);
		const dispatched = windowDispatchSpy.mock.calls[0]?.[0];
		expect(dispatched).toBeInstanceOf(CustomEvent);
		expect((dispatched as CustomEvent).type).toBe('jarvis:close');

		expect(navigateMock).toHaveBeenCalledTimes(1);
		expect(navigateMock).toHaveBeenCalledWith('/emails?thread=th_1');
	});
});