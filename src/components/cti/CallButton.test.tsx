// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { CallButton } from './CallButton';

const { startCallMock, buttonSpy, cnMock } = vi.hoisted(() => ({
  startCallMock: vi.fn(),
  buttonSpy: vi.fn(),
  cnMock: vi.fn((...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ')
  ),
}));

vi.mock('lucide-react', () => ({
  Phone: ({ className }: { className?: string }) => (
    <svg data-testid="phone-icon" className={className} />
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    title,
    disabled,
    variant,
    size,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
    title?: string;
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => {
    buttonSpy({ className, title, disabled, variant, size, rest });
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        title={title}
        disabled={disabled}
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        {children}
      </button>
    );
  },
}));

vi.mock('@/contexts/CallContext', () => ({
  useCallContext: () => ({
    startCall: startCallMock,
  }),
}));

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}));

describe('CallButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders enabled call button with default label and starts call with full target payload', () => {
    render(
      <CallButton
        phoneNumber="0601020304"
        displayName="Jean Dupont"
        contactId="contact-1"
        etablissementId="eta-1"
        prospectId="prospect-1"
      />
    );

    const button = screen.getByRole('button', { name: /appeler/i });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('title', 'Appeler 0601020304');
    expect(button).toHaveAttribute('data-variant', 'outline');
    expect(button).toHaveAttribute('data-size', 'sm');
    expect(screen.getByText('Appeler')).toBeInTheDocument();

    const icon = screen.getByTestId('phone-icon');
    expect(icon).toHaveClass('h-4', 'w-4', 'mr-2');

    fireEvent.click(button);

    expect(startCallMock).toHaveBeenCalledTimes(1);
    expect(startCallMock).toHaveBeenCalledWith({
      phoneNumber: '0601020304',
      displayName: 'Jean Dupont',
      contactId: 'contact-1',
      etablissementId: 'eta-1',
      prospectId: 'prospect-1',
    });
  });

  it('uses custom label, className, variant and size', () => {
    render(
      <CallButton
        phoneNumber="0700000000"
        label="Contacter"
        className="custom-class"
        variant="default"
        size="lg"
      />
    );

    const button = screen.getByRole('button', { name: /contacter/i });
    expect(button).toHaveAttribute('title', 'Contacter 0700000000');
    expect(button).toHaveAttribute('data-variant', 'default');
    expect(button).toHaveAttribute('data-size', 'lg');
    expect(button).toHaveClass('custom-class');

    expect(cnMock).toHaveBeenCalledWith(false, 'custom-class');
  });

  it('renders icon only mode without text and with compact classes', () => {
    render(
      <CallButton
        phoneNumber="0611223344"
        iconOnly
        label="Joindre"
        className="extra"
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('title', 'Joindre 0611223344');
    expect(screen.queryByText('Joindre')).not.toBeInTheDocument();

    const icon = screen.getByTestId('phone-icon');
    expect(icon).toHaveClass('h-4', 'w-4');
    expect(icon).not.toHaveClass('mr-2');

    expect(cnMock).toHaveBeenCalledWith('h-8 w-8 p-0', 'extra');
    expect(cnMock).toHaveBeenCalledWith('h-4 w-4', false);
  });

  it('is disabled and does not start a call when phoneNumber is missing', () => {
    render(<CallButton displayName="Sans numéro" />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Numéro indisponible');

    fireEvent.click(button);

    expect(startCallMock).not.toHaveBeenCalled();
  });

  it('stays disabled when disabled prop is passed even with a phone number', () => {
    render(<CallButton phoneNumber="0600000000" disabled label="Appeler contact" />);

    const button = screen.getByRole('button', { name: /appeler contact/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Appeler contact 0600000000');

    fireEvent.click(button);

    expect(startCallMock).not.toHaveBeenCalled();
  });

  it('prevents default and stops propagation before starting the call', () => {
    render(<CallButton phoneNumber="0655667788" displayName="Marie" />);

    const button = screen.getByRole('button', { name: /appeler/i });

    const event = createEvent.click(button);
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fireEvent(button, event);

    expect(stopPropagationSpy).toHaveBeenCalledTimes(1);
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(startCallMock).toHaveBeenCalledTimes(1);
    expect(startCallMock).toHaveBeenCalledWith({
      phoneNumber: '0655667788',
      displayName: 'Marie',
      contactId: undefined,
      etablissementId: undefined,
      prospectId: undefined,
    });
  });

  it('passes through extra button props', () => {
    render(
      <CallButton
        phoneNumber="0699887766"
        aria-label="call-special"
        data-testid="call-btn"
      />
    );

    const button = screen.getByTestId('call-btn');
    expect(button).toHaveAttribute('aria-label', 'call-special');
    expect(button).toHaveAttribute('title', 'Appeler 0699887766');
  });
});