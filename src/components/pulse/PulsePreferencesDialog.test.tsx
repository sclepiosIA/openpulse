// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PulsePreferencesDialog } from './PulsePreferencesDialog';

const {
  SOUND_ENABLED_INITIAL,
  DESKTOP_ENABLED_INITIAL,
  mockIsPulseSoundEnabled,
  mockSetPulseSoundEnabled,
  mockIsPulseDesktopEnabled,
  mockSetPulseDesktopEnabled,
  mockOnOpenChange,
} = vi.hoisted(() => ({
  SOUND_ENABLED_INITIAL: true,
  DESKTOP_ENABLED_INITIAL: false,
  mockIsPulseSoundEnabled: vi.fn(),
  mockSetPulseSoundEnabled: vi.fn(),
  mockIsPulseDesktopEnabled: vi.fn(),
  mockSetPulseDesktopEnabled: vi.fn(),
  mockOnOpenChange: vi.fn(),
}));

vi.mock('@/lib/pulsePreferences', () => ({
  isPulseSoundEnabled: mockIsPulseSoundEnabled,
  setPulseSoundEnabled: mockSetPulseSoundEnabled,
  isPulseDesktopEnabled: mockIsPulseDesktopEnabled,
  setPulseDesktopEnabled: mockSetPulseDesktopEnabled,
  getPulseTheme: () => ({
    bubbleId: 'default',
    bgId: 'default',
    fontSize: 'md',
    density: 'cozy',
    shape: 'bubble',
  }),
  setPulseTheme: vi.fn(),
  PULSE_BUBBLE_PRESETS: [
    { id: 'default', label: 'OpenPulse', bg: '#0f172a', fg: '#ffffff' },
  ],
  PULSE_BG_PRESETS: [
    { id: 'default', label: 'Par défaut', bg: '' },
  ],
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="dialog-root" data-open={String(open)}>
      <button type="button" onClick={() => onOpenChange(false)}>
        close
      </button>
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    id,
    checked,
    onCheckedChange,
    'aria-label': ariaLabel,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
    'aria-label'?: string;
  }) => (
    <button
      type="button"
      role="switch"
      id={id}
      aria-label={ariaLabel}
      aria-checked={checked ? 'true' : 'false'}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? 'on' : 'off'}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg aria-hidden="true" {...props} />;
  return {
    Bell: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="bell-icon" {...props} />,
    Volume2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="volume-icon" {...props} />,
    Palette: Icon,
    Image: Icon,
    Check: Icon,
    Type: Icon,
    Rows3: Icon,
    Square: Icon,
  };
});

function openNotificationsTab() {
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Notifications' }), {
    button: 0,
    ctrlKey: false,
  });
}

describe('PulsePreferencesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPulseSoundEnabled.mockReturnValue(SOUND_ENABLED_INITIAL);
    mockIsPulseDesktopEnabled.mockReturnValue(DESKTOP_ENABLED_INITIAL);

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
    });
  });

  it('affiche les préférences initiales depuis le stockage métier', () => {
    render(<PulsePreferencesDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(mockIsPulseSoundEnabled).toHaveBeenCalled();
    expect(mockIsPulseDesktopEnabled).toHaveBeenCalled();

    expect(screen.getByText('Préférences Pulse')).toBeInTheDocument();
    expect(screen.getByText('Personnalisez notifications et apparence de votre messagerie.')).toBeInTheDocument();

    openNotificationsTab();
    const soundSwitch = screen.getByRole('switch', { name: 'Son de notification' });
    const desktopSwitch = screen.getByRole('switch', { name: 'Notifications navigateur' });

    expect(soundSwitch).toHaveAttribute('aria-checked', 'true');
    expect(desktopSwitch).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('dialog-root')).toHaveAttribute('data-open', 'true');
  });

  it('met à jour la préférence sonore et persiste la valeur réelle', () => {
    render(<PulsePreferencesDialog open={true} onOpenChange={mockOnOpenChange} />);

    openNotificationsTab();
    const soundSwitch = screen.getByRole('switch', { name: 'Son de notification' });

    fireEvent.click(soundSwitch);

    expect(mockSetPulseSoundEnabled).toHaveBeenCalledTimes(1);
    expect(mockSetPulseSoundEnabled).toHaveBeenCalledWith(false);
    expect(soundSwitch).toHaveAttribute('aria-checked', 'false');
  });

  it('met à jour la préférence desktop et demande la permission navigateur si nécessaire', () => {
    render(<PulsePreferencesDialog open={true} onOpenChange={mockOnOpenChange} />);

    openNotificationsTab();
    const desktopSwitch = screen.getByRole('switch', { name: 'Notifications navigateur' });

    fireEvent.click(desktopSwitch);

    expect(mockSetPulseDesktopEnabled).toHaveBeenCalledTimes(1);
    expect(mockSetPulseDesktopEnabled).toHaveBeenCalledWith(true);
    expect(desktopSwitch).toHaveAttribute('aria-checked', 'true');
    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('ne redemande pas la permission si les notifications navigateur sont déjà autorisées', () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: {
        permission: 'granted',
        requestPermission: vi.fn(),
      },
    });

    render(<PulsePreferencesDialog open={true} onOpenChange={mockOnOpenChange} />);

    openNotificationsTab();
    const desktopSwitch = screen.getByRole('switch', { name: 'Notifications navigateur' });

    fireEvent.click(desktopSwitch);

    expect(mockSetPulseDesktopEnabled).toHaveBeenCalledWith(true);
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('propage onOpenChange depuis le Dialog', () => {
    render(<PulsePreferencesDialog open={true} onOpenChange={mockOnOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(mockOnOpenChange).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});