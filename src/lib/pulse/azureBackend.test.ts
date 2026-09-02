import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PULSE_BACKEND,
  PULSE_BACKEND_MODES,
  derivePulseWsUrl,
  normalizeBaseUrl,
  parsePulseBackendMode,
  resolvePulseAzureConfig,
} from './azureBackend'

describe('parsePulseBackendMode', () => {
  it('retourne supabase par défaut (flag absent)', () => {
    expect(parsePulseBackendMode(undefined)).toBe('supabase')
    expect(parsePulseBackendMode(null)).toBe('supabase')
    expect(parsePulseBackendMode('')).toBe('supabase')
  })

  it('accepte les trois modes valides', () => {
    for (const mode of PULSE_BACKEND_MODES) {
      expect(parsePulseBackendMode(mode)).toBe(mode)
    }
  })

  it('normalise casse et espaces', () => {
    expect(parsePulseBackendMode('  AZURE ')).toBe('azure')
    expect(parsePulseBackendMode('Hybrid')).toBe('hybrid')
  })

  it('replie silencieusement les valeurs invalides sur supabase', () => {
    expect(parsePulseBackendMode('signalr')).toBe(DEFAULT_PULSE_BACKEND)
    expect(parsePulseBackendMode(42)).toBe(DEFAULT_PULSE_BACKEND)
  })
})

describe('normalizeBaseUrl', () => {
  it('supprime les trailing slashes', () => {
    expect(normalizeBaseUrl('https://api.example.com/')).toBe('https://api.example.com')
    expect(normalizeBaseUrl('https://api.example.com///')).toBe('https://api.example.com')
  })

  it('retourne null pour vide/non-string', () => {
    expect(normalizeBaseUrl('')).toBeNull()
    expect(normalizeBaseUrl('   ')).toBeNull()
    expect(normalizeBaseUrl(undefined)).toBeNull()
  })
})

describe('derivePulseWsUrl', () => {
  it('convertit https en wss avec le chemin /api/pulse/ws', () => {
    expect(derivePulseWsUrl('https://pulse-api.azure.example')).toBe(
      'wss://pulse-api.azure.example/api/pulse/ws'
    )
  })

  it('convertit http en ws (dev local)', () => {
    expect(derivePulseWsUrl('http://localhost:8080')).toBe('ws://localhost:8080/api/pulse/ws')
  })

  it('préserve un éventuel préfixe de chemin', () => {
    expect(derivePulseWsUrl('https://gw.example.com/pulse')).toBe(
      'wss://gw.example.com/pulse/api/pulse/ws'
    )
  })

  it('retourne null pour une URL invalide ou absente', () => {
    expect(derivePulseWsUrl(null)).toBeNull()
    expect(derivePulseWsUrl('pas-une-url')).toBeNull()
  })
})

describe('resolvePulseAzureConfig', () => {
  it('mode supabase par défaut : Azure désactivé, realtime Supabase actif', () => {
    const config = resolvePulseAzureConfig({})
    expect(config.mode).toBe('supabase')
    expect(config.azureEnabled).toBe(false)
    expect(config.supabaseRealtimeActive).toBe(true)
    expect(config.apiBaseUrl).toBeNull()
    expect(config.wsUrl).toBeNull()
    expect(config.fallbackApplied).toBe(false)
  })

  it('mode azure : Azure actif, realtime Supabase coupé', () => {
    const config = resolvePulseAzureConfig({
      VITE_PULSE_BACKEND: 'azure',
      VITE_PULSE_AZURE_API_URL: 'https://openpulse-pulse-api.azure.example/',
    })
    expect(config.mode).toBe('azure')
    expect(config.azureEnabled).toBe(true)
    expect(config.supabaseRealtimeActive).toBe(false)
    expect(config.apiBaseUrl).toBe('https://openpulse-pulse-api.azure.example')
    expect(config.wsUrl).toBe('wss://openpulse-pulse-api.azure.example/api/pulse/ws')
  })

  it('mode hybrid : Azure ET Supabase realtime actifs', () => {
    const config = resolvePulseAzureConfig({ VITE_PULSE_BACKEND: 'hybrid' })
    expect(config.azureEnabled).toBe(true)
    expect(config.supabaseRealtimeActive).toBe(true)
  })

  it('VITE_PULSE_AZURE_WS_URL explicite prime sur la dérivation', () => {
    const config = resolvePulseAzureConfig({
      VITE_PULSE_BACKEND: 'azure',
      VITE_PULSE_AZURE_API_URL: 'https://api.example.com',
      VITE_PULSE_AZURE_WS_URL: 'wss://realtime.example.com/ws',
    })
    expect(config.wsUrl).toBe('wss://realtime.example.com/ws')
  })

  it('flag invalide : repli supabase + fallbackApplied', () => {
    const config = resolvePulseAzureConfig({ VITE_PULSE_BACKEND: 'firebase' })
    expect(config.mode).toBe('supabase')
    expect(config.fallbackApplied).toBe(true)
    expect(config.rawMode).toBe('firebase')
  })
})
