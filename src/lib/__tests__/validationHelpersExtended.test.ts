import { describe, expect, it } from 'vitest';
import {
  getPasswordStrength,
  isInRange,
  isRequired,
  isValidAmount,
  isValidEmail,
  isValidFibonacciPoints,
  isValidFrenchPhone,
  isValidFrenchPostalCode,
  isValidSlug,
  isValidUrl,
} from '../validationHelpers';

describe('validationHelpers extended cases', () => {
  it('valide les emails avec sous-domaines et rejette les espaces', () => {
    expect(isValidEmail('prenom.nom@chu-centre.sante.example.org')).toBe(true);
    expect(isValidEmail('prenom nom@sante.fr')).toBe(false);
    expect(isValidEmail('prenom@sante .fr')).toBe(false);
  });

  it('accepte les téléphones français séparés par espaces points ou tirets', () => {
    expect(isValidFrenchPhone('06 12 34 56 78')).toBe(true);
    expect(isValidFrenchPhone('06.12.34.56.78')).toBe(true);
    expect(isValidFrenchPhone('06-12-34-56-78')).toBe(true);
    expect(isValidFrenchPhone('0012345678')).toBe(false);
  });

  it('classe les mots de passe aux seuils exacts', () => {
    expect(getPasswordStrength('abcdefg1')).toBe('medium');
    expect(getPasswordStrength('Abcdefgh')).toBe('medium');
    expect(getPasswordStrength('Abcdefghijk1!')).toBe('strong');
  });

  it('gère les bornes inclusives pour les plages numériques', () => {
    expect(isInRange(0, 0, 10)).toBe(true);
    expect(isInRange(10, 0, 10)).toBe(true);
    expect(isInRange(11, 0, 10)).toBe(false);
  });

  it('considère les objets et booléens comme requis quand non nuls', () => {
    expect(isRequired({})).toBe(true);
    expect(isRequired(false)).toBe(true);
    expect(isRequired(Number.NaN)).toBe(true);
  });

  it('valide strictement les codes postaux et montants', () => {
    expect(isValidFrenchPostalCode('97200')).toBe(true);
    expect(isValidFrenchPostalCode('7500A')).toBe(false);
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('valide uniquement les points Fibonacci supportés', () => {
    expect(isValidFibonacciPoints(34)).toBe(true);
    expect(isValidFibonacciPoints(0)).toBe(false);
    expect(isValidFibonacciPoints(55)).toBe(false);
  });

  it('valide les URLs et slugs selon leur format strict', () => {
    expect(isValidUrl('mailto:contact@exploitant.example.org')).toBe(true);
    expect(isValidUrl('https://gestion.exploitant.example.org/path?tab=1')).toBe(true);
    expect(isValidSlug('formation-resurgences-2026')).toBe(true);
    expect(isValidSlug('formation_resurgences')).toBe(false);
  });
});