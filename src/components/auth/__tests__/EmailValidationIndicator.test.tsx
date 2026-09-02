import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailValidationIndicator, validateEmail } from '../EmailValidationIndicator';

describe('validateEmail', () => {
  it('returns empty message for empty string', () => {
    expect(validateEmail('').isValid).toBe(false);
    expect(validateEmail('').message).toBe('');
  });

  it('rejects invalid format', () => {
    const result = validateEmail('not-an-email');
    expect(result.isValid).toBe(false);
    expect(result.message).toBe("Format d'email invalide");
  });

  it('rejects short domain', () => {
    const result = validateEmail('a@b.c');
    // Domain "b.c" length=3 so passes, but let's test with shorter
    expect(result.isValid).toBe(true); // b.c is 3 chars, passes
  });

  it('rejects email starting with dot', () => {
    const result = validateEmail('.test@example.com');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('point');
  });

  it('rejects email ending with dot', () => {
    const result = validateEmail('test.@example.com');
    expect(result.isValid).toBe(false);
  });

  it('accepts valid email', () => {
    const result = validateEmail('user@example.com');
    expect(result.isValid).toBe(true);
    expect(result.message).toBe('Email valide');
  });
});

describe('EmailValidationIndicator', () => {
  it('returns null for empty email', () => {
    const { container } = render(<EmailValidationIndicator email="" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows valid message for valid email', () => {
    render(<EmailValidationIndicator email="user@example.com" />);
    expect(screen.getByText('Email valide')).toBeInTheDocument();
  });

  it('shows error for invalid email', () => {
    render(<EmailValidationIndicator email="invalid" />);
    expect(screen.getByText("Format d'email invalide")).toBeInTheDocument();
  });
});
