import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailNotificationSettings } from '../EmailNotificationSettings';

describe('EmailNotificationSettings', () => {
  it('renders notification card title', () => {
    render(<EmailNotificationSettings />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('renders desktop notifications switch', () => {
    render(<EmailNotificationSettings />);
    expect(screen.getByText('Notifications bureau')).toBeInTheDocument();
    expect(screen.getByLabelText('Notifications bureau')).toBeChecked();
  });

  it('renders sound switch', () => {
    render(<EmailNotificationSettings />);
    expect(screen.getByText('Son de notification')).toBeInTheDocument();
    expect(screen.getByLabelText('Son de notification')).not.toBeChecked();
  });

  it('toggles desktop notification switch', () => {
    render(<EmailNotificationSettings />);
    const switchEl = screen.getByLabelText('Notifications bureau');
    fireEvent.click(switchEl);
    expect(switchEl).not.toBeChecked();
  });

  it('renders preview switch', () => {
    render(<EmailNotificationSettings />);
    expect(screen.getByText('Aperçu dans la notification')).toBeInTheDocument();
  });
});
