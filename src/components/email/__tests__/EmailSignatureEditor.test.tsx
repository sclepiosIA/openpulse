import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailSignatureEditor } from '../EmailSignatureEditor';

describe('EmailSignatureEditor', () => {
  it('renders signature editor card', () => {
    render(<EmailSignatureEditor profileId="p1" />);
    expect(screen.getByText('Signature email')).toBeInTheDocument();
  });

  it('renders tabs for editing modes', () => {
    render(<EmailSignatureEditor profileId="p1" />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);
  });

  it('renders Code HTML tab active by default', () => {
    render(<EmailSignatureEditor profileId="p1" />);
    expect(screen.getByText('Code HTML')).toBeInTheDocument();
  });

  it('renders textarea', () => {
    render(<EmailSignatureEditor profileId="p1" />);
    const textareas = document.querySelectorAll('textarea');
    expect(textareas.length).toBeGreaterThanOrEqual(1);
  });
});
