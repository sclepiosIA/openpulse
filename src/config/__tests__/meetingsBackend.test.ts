import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MEETINGS_BACKEND,
  MEETINGS_BACKENDS,
  canReachAzureMeetingsApi,
  getMeetingsApiBaseUrl,
  getTranscriptionBackend,
  getVisioBackend,
  isAzureMeetingsEnabled,
  parseMeetingsBackend,
} from '../meetingsBackend'

describe('meetingsBackend config (lot 1 Azure Meetings)', () => {
  describe('parseMeetingsBackend', () => {
    it('retourne supabase par défaut (undefined/null/vide)', () => {
      expect(parseMeetingsBackend(undefined)).toBe('supabase')
      expect(parseMeetingsBackend(null)).toBe('supabase')
      expect(parseMeetingsBackend('')).toBe('supabase')
    })

    it('accepte les trois valeurs valides', () => {
      expect(parseMeetingsBackend('supabase')).toBe('supabase')
      expect(parseMeetingsBackend('azure')).toBe('azure')
      expect(parseMeetingsBackend('hybrid')).toBe('hybrid')
    })

    it('normalise casse et espaces', () => {
      expect(parseMeetingsBackend('  AZURE ')).toBe('azure')
      expect(parseMeetingsBackend('Hybrid')).toBe('hybrid')
    })

    it('retombe sur le fallback pour une valeur inconnue', () => {
      expect(parseMeetingsBackend('livekit')).toBe('supabase')
      expect(parseMeetingsBackend('n/a', 'hybrid')).toBe('hybrid')
    })

    it('expose le défaut et la liste des backends', () => {
      expect(DEFAULT_MEETINGS_BACKEND).toBe('supabase')
      expect(MEETINGS_BACKENDS).toEqual(['supabase', 'azure', 'hybrid'])
    })
  })

  describe('getVisioBackend / getTranscriptionBackend (env injecté)', () => {
    it('supabase par défaut quand les flags sont absents', () => {
      expect(getVisioBackend({})).toBe('supabase')
      expect(getTranscriptionBackend({})).toBe('supabase')
    })

    it('lit VITE_VISIO_BACKEND', () => {
      expect(getVisioBackend({ VITE_VISIO_BACKEND: 'azure' })).toBe('azure')
      expect(getVisioBackend({ VITE_VISIO_BACKEND: 'hybrid' })).toBe('hybrid')
    })

    it('lit VITE_TRANSCRIPTION_BACKEND indépendamment du flag visio', () => {
      const env = { VITE_VISIO_BACKEND: 'supabase', VITE_TRANSCRIPTION_BACKEND: 'hybrid' }
      expect(getVisioBackend(env)).toBe('supabase')
      expect(getTranscriptionBackend(env)).toBe('hybrid')
    })

    it('valeur invalide → retombe sur supabase (sécurité non-régression)', () => {
      expect(getVisioBackend({ VITE_VISIO_BACKEND: 'webrtc-legacy' })).toBe('supabase')
    })
  })

  describe('getMeetingsApiBaseUrl', () => {
    it('chaîne vide si non configurée', () => {
      expect(getMeetingsApiBaseUrl({})).toBe('')
      expect(getMeetingsApiBaseUrl({ VITE_MEETINGS_API_BASE_URL: '   ' })).toBe('')
    })

    it('supprime les slashs finaux', () => {
      expect(
        getMeetingsApiBaseUrl({ VITE_MEETINGS_API_BASE_URL: 'https://api.example.com///' })
      ).toBe('https://api.example.com')
    })
  })

  describe('isAzureMeetingsEnabled / canReachAzureMeetingsApi', () => {
    it('désactivé quand tout est supabase (défaut) — non-régression', () => {
      expect(isAzureMeetingsEnabled({})).toBe(false)
      expect(canReachAzureMeetingsApi({})).toBe(false)
    })

    it('activé dès qu’un domaine passe en azure ou hybrid', () => {
      expect(isAzureMeetingsEnabled({ VITE_VISIO_BACKEND: 'hybrid' })).toBe(true)
      expect(isAzureMeetingsEnabled({ VITE_TRANSCRIPTION_BACKEND: 'azure' })).toBe(true)
    })

    it('canReach exige flag actif ET base URL', () => {
      expect(canReachAzureMeetingsApi({ VITE_TRANSCRIPTION_BACKEND: 'azure' })).toBe(false)
      expect(
        canReachAzureMeetingsApi({ VITE_MEETINGS_API_BASE_URL: 'https://api.example.com' })
      ).toBe(false) // URL seule sans flag ≠ activation
      expect(
        canReachAzureMeetingsApi({
          VITE_TRANSCRIPTION_BACKEND: 'hybrid',
          VITE_MEETINGS_API_BASE_URL: 'https://api.example.com',
        })
      ).toBe(true)
    })
  })
})
