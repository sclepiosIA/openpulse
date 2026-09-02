import React from 'react';
import { render, screen, within, fireEvent, act } from '@testing-library/react';

const { IO, triggerIntersect } = vi.hoisted(() => {
  const IO = vi.fn(function (this: any, callback: (entries: any[]) => void) {
    const instance = {
      callback,
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
    (IO as any)._instances = (IO as any)._instances || [];
    (IO as any)._instances.push(instance);
    return instance;
  });
  const triggerIntersect = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const instances = (IO as any)._instances || [];
    instances.forEach((inst: any) => inst.callback([{ isIntersecting: true, target: el }]));
  };
  return { IO, triggerIntersect };
});

const { mockCn, MockButton, MockSheet, MockSheetContent, MockSheetTrigger, MockIcons } = vi.hoisted(() => {
  const mockCn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');
  const MockButton = ({ children, onClick, className, ...rest }: any) => (
    <button onClick={onClick} className={className} {...rest}>
      {children}
    </button>
  );
  const MockSheet = ({ children }: any) => <div data-testid="sheet">{children}</div>;
  const MockSheetContent = ({ children, ...rest }: any) => <div data-testid="sheet-content" {...rest}>{children}</div>;
  const MockSheetTrigger = ({ children }: any) => <>{children}</>;
  const Icon = ({ className }: any) => <span data-icon="icon" className={className} />;
  const MockIcons = {
    Shield: Icon,
    Server: Icon,
    Lock: Icon,
    ScrollText: Icon,
    UserCog: Icon,
    Phone: Icon,
    Menu: Icon,
    X: Icon,
  };
  return { mockCn, MockButton, MockSheet, MockSheetContent, MockSheetTrigger, MockIcons };
});

vi.mock('@/lib/utils', () => ({ cn: mockCn }));
vi.mock('@/components/ui/button', () => ({ Button: MockButton }));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: MockSheet,
  SheetContent: MockSheetContent,
  SheetTrigger: MockSheetTrigger,
}));
vi.mock('lucide-react', () => ({
  ...MockIcons,
}));

Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: IO });
Object.defineProperty(global, 'IntersectionObserver', { writable: true, value: IO });

window.scrollTo = vi.fn();

import { DpoNavigationScrollSpy } from './DpoNavigationScrollSpy';

describe('DpoNavigationScrollSpy', () => {
  const sectionIds = ['engagements', 'hebergement', 'securite', 'traitements', 'droits', 'contact'];
  const cleanupEls: HTMLElement[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    // Create section elements with stable refs and bbox
    sectionIds.forEach((id, index) => {
      const el = document.createElement('section');
      el.id = id;
      el.textContent = `Section ${id}`;
      el.getBoundingClientRect = () =>
        ({ top: (index + 1) * 400, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as any;
      document.body.appendChild(el);
      cleanupEls.push(el);
    });
  });

  afterEach(() => {
    cleanupEls.splice(0).forEach((el) => el.remove());
  });

  it('renders nav items and positions the active indicator initially', () => {
    render(<DpoNavigationScrollSpy />);
    // There are two navs (desktop and mobile), so items appear at least once
    expect(screen.getAllByRole('button', { name: 'Nos engagements' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Mesures de sécurité' }).length).toBeGreaterThan(0);

    const navs = document.querySelectorAll('nav');
    expect(navs.length).toBeGreaterThanOrEqual(2);
    const desktopNav = navs[0] as HTMLElement;

    // Indicator should be at 4px for initial active index 0
    const indicator = desktopNav.querySelector('div[style]') as HTMLDivElement;
    expect(indicator).toBeTruthy();
    expect(indicator.style.top).toBe('4px');
  });

  it('calls visibility callback and toggles desktop visibility button classes', () => {
    const onChange = vi.fn();
    render(<DpoNavigationScrollSpy onDesktopVisibilityChange={onChange} />);

    // Called on mount with true
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);

    const toggleBtn = screen.getByRole('button', { name: 'Fermer' });
    expect(toggleBtn.className).toContain('left-[17rem]');

    fireEvent.click(toggleBtn);

    // Callback called again with false
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(toggleBtn.className).toContain('left-4');
  });

  it('updates active section on intersection and reflects styles in desktop and mobile', () => {
    render(<DpoNavigationScrollSpy />);

    act(() => {
      triggerIntersect('securite');
    });

    const navs = document.querySelectorAll('nav');
    const desktopNav = navs[0] as HTMLElement;
    const mobileNav = navs[1] as HTMLElement;

    const desktopIndicator = desktopNav.querySelector('div[style]') as HTMLDivElement;
    const mobileIndicator = mobileNav.querySelector('div[style]') as HTMLDivElement;

    // 'securite' index is 2 -> desktop top = 2*44 + 4 = 92px; mobile top = 2*48 + 4 = 100px
    expect(desktopIndicator.style.top).toBe('92px');
    expect(mobileIndicator.style.top).toBe('100px');

    const securiteBtnDesktop = within(desktopNav).getByRole('button', { name: 'Mesures de sécurité' });
    expect(securiteBtnDesktop.className).toContain('font-semibold');
  });

  it('scrolls smoothly to a section when a nav item is clicked', () => {
    render(<DpoNavigationScrollSpy />);

    const contactButtons = screen.getAllByRole('button', { name: 'Contact DPO & FAQ' });
    expect(contactButtons.length).toBeGreaterThan(0);
    const contactBtn = contactButtons[0];

    (window.scrollTo as any).mockClear();
    // getBoundingClientRect for 'contact' set to (index+1)*400; index of 'contact' is 5 => top 2400
    fireEvent.click(contactBtn);

    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    const callArg = (window.scrollTo as any).mock.calls[0][0];
    // top should be 2400 - 100 = 2300
    expect(callArg.top).toBe(2300);
    expect(callArg.behavior).toBe('smooth');
  });
});