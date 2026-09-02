import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  parseEmailBackend,
  getEmailBackend,
  isAzureEmailBackendEnabled,
  isSupabaseEmailBackendActive,
  getEmailAzureApiBaseUrl,
  DEFAULT_EMAIL_BACKEND,
  EMAIL_BACKEND_MODES,
} from './emailBackend';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parseEmailBackend', () => {
  it('retourne supabase par défaut pour une valeur absente', () => {
    expect(parseEmailBackend(undefined)).toBe('supabase');
    expect(parseEmailBackend(null)).toBe('supabase');
    expect(parseEmailBackend('')).toBe('supabase');
  });

  it('retourne supabase pour une valeur inconnue (fail-safe)', () => {
    expect(parseEmailBackend('plateforme-edition')).toBe('supabase');
    expect(parseEmailBackend('AZURE!!')).toBe('supabase');
    expect(parseEmailBackend('42')).toBe('supabase');
  });

  it('accepte les trois modes valides, insensible à la casse et aux espaces', () => {
    expect(parseEmailBackend('supabase')).toBe('supabase');
    expect(parseEmailBackend('azure')).toBe('azure');
    expect(parseEmailBackend('hybrid')).toBe('hybrid');
    expect(parseEmailBackend(' AZURE ')).toBe('azure');
    expect(parseEmailBackend('Hybrid')).toBe('hybrid');
  });

  it('expose supabase comme défaut documenté', () => {
    expect(DEFAULT_EMAIL_BACKEND).toBe('supabase');
    expect(EMAIL_BACKEND_MODES).toContain('supabase');
    expect(EMAIL_BACKEND_MODES).toHaveLength(3);
  });
});

describe('getEmailBackend / helpers (via import.meta.env)', () => {
  it('mode par défaut : backend supabase, Azure désactivé', () => {
    vi.stubEnv('VITE_EMAIL_BACKEND', '');
    expect(getEmailBackend()).toBe('supabase');
    expect(isAzureEmailBackendEnabled()).toBe(false);
    expect(isSupabaseEmailBackendActive()).toBe(true);
  });

  it('mode hybrid : Azure activé ET Supabase toujours actif (non destructif)', () => {
    vi.stubEnv('VITE_EMAIL_BACKEND', 'hybrid');
    expect(getEmailBackend()).toBe('hybrid');
    expect(isAzureEmailBackendEnabled()).toBe(true);
    expect(isSupabaseEmailBackendActive()).toBe(true);
  });

  it('mode azure : Azure activé, Supabase plus source UI', () => {
    vi.stubEnv('VITE_EMAIL_BACKEND', 'azure');
    expect(getEmailBackend()).toBe('azure');
    expect(isAzureEmailBackendEnabled()).toBe(true);
    expect(isSupabaseEmailBackendActive()).toBe(false);
  });

  it('valeur invalide dans env : retombe sur supabase', () => {
    vi.stubEnv('VITE_EMAIL_BACKEND', 'banana');
    expect(getEmailBackend()).toBe('supabase');
    expect(isAzureEmailBackendEnabled()).toBe(false);
  });
});

describe('getEmailAzureApiBaseUrl', () => {
  it('retourne null si non configurée ou vide', () => {
    vi.stubEnv('VITE_EMAIL_AZURE_API_URL', '');
    expect(getEmailAzureApiBaseUrl()).toBeNull();
    vi.stubEnv('VITE_EMAIL_AZURE_API_URL', '   ');
    expect(getEmailAzureApiBaseUrl()).toBeNull();
  });

  it('normalise le trailing slash', () => {
    vi.stubEnv('VITE_EMAIL_AZURE_API_URL', 'https://openpulse-email-api.azure.example/');
    expect(getEmailAzureApiBaseUrl()).toBe('https://openpulse-email-api.azure.example');
    vi.stubEnv('VITE_EMAIL_AZURE_API_URL', 'https://openpulse-email-api.azure.example///');
    expect(getEmailAzureApiBaseUrl()).toBe('https://openpulse-email-api.azure.example');
  });
});
