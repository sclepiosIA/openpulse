import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordStrengthIndicator, getPasswordStrength } from '../PasswordStrengthIndicator';

describe('getPasswordStrength', () => {
  it('returns "Très faible" for short passwords', () => {
    expect(getPasswordStrength('a').label).toBe('Très faible');
    expect(getPasswordStrength('a').score).toBe(1);
  });

  it('returns "Faible" for 2 rules passed', () => {
    expect(getPasswordStrength('abcdefgh').label).toBe('Faible');
  });

  it('returns "Moyen" for 3 rules passed', () => {
    expect(getPasswordStrength('Abcdefgh').label).toBe('Moyen');
  });

  it('returns "Fort" for 4 rules passed', () => {
    expect(getPasswordStrength('Abcdefg1').label).toBe('Fort');
  });

  it('returns "Très fort" for all 5 rules passed', () => {
    const result = getPasswordStrength('Abcdefg1!');
    expect(result.label).toBe('Très fort');
    expect(result.score).toBe(5);
  });
});

describe('PasswordStrengthIndicator', () => {
  it('returns null when password is empty', () => {
    const { container } = render(<PasswordStrengthIndicator password="" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders strength label', () => {
    render(<PasswordStrengthIndicator password="Abcdefg1!" />);
    expect(screen.getByText('Très fort')).toBeInTheDocument();
  });

  it('renders all 5 rules', () => {
    render(<PasswordStrengthIndicator password="a" />);
    expect(screen.getByText('Au moins 8 caractères')).toBeInTheDocument();
    expect(screen.getByText('Une lettre majuscule')).toBeInTheDocument();
    expect(screen.getByText('Une lettre minuscule')).toBeInTheDocument();
    expect(screen.getByText('Un chiffre')).toBeInTheDocument();
    expect(screen.getByText('Un caractère spécial')).toBeInTheDocument();
  });

  it('shows progress bar', () => {
    render(<PasswordStrengthIndicator password="test" />);
    expect(screen.getByText('Force du mot de passe')).toBeInTheDocument();
  });
});
