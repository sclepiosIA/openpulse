import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: '123' } } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  },
}))

describe('Email Utilities', () => {
  describe('Email Address Validation', () => {
    it('should validate correct email addresses', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      
      const validEmails = ['test@example.com', 'user.name@domain.org', 'first+last@company.co.uk']
      validEmails.forEach(email => expect(emailRegex.test(email)).toBe(true))
    })

    it('should reject invalid email addresses', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const invalidEmails = ['invalid', '@domain.com', 'user@', 'user@domain']
      invalidEmails.forEach(email => expect(emailRegex.test(email)).toBe(false))
    })
  })

  describe('Email Thread Grouping', () => {
    it('should extract thread subject correctly', () => {
      const extractBaseSubject = (subject: string): string => {
        return subject.replace(/^(RE:|FW:|TR:|Re:|Fw:|Tr:)\s*/gi, '').replace(/^(RE:|FW:|TR:|Re:|Fw:|Tr:)\s*/gi, '').trim()
      }
      
      expect(extractBaseSubject('RE: Hello World')).toBe('Hello World')
      expect(extractBaseSubject('Fw: RE: Test')).toBe('Test')
      expect(extractBaseSubject('Hello World')).toBe('Hello World')
    })
  })

  describe('Email Classification', () => {
    it('should detect email categories from keywords', () => {
      const categorizeEmail = (subject: string, body: string): string => {
        const text = `${subject} ${body}`.toLowerCase()
        if (text.includes('facture') || text.includes('devis')) return 'commercial'
        if (text.includes('bug') || text.includes('erreur')) return 'support'
        if (text.includes('contrat') || text.includes('signature')) return 'administratif'
        return 'autre'
      }
      
      expect(categorizeEmail('Demande de devis', 'Bonjour')).toBe('commercial')
      expect(categorizeEmail('Problème', 'erreur connexion')).toBe('support')
      expect(categorizeEmail('Signature contrat', 'Veuillez')).toBe('administratif')
    })

    it('should detect urgency from keywords', () => {
      const detectUrgency = (subject: string, body: string): boolean => {
        const urgentKeywords = ['urgent', 'urgence', 'asap', 'critique', 'bloquant']
        const text = `${subject} ${body}`.toLowerCase()
        return urgentKeywords.some(keyword => text.includes(keyword))
      }
      
      expect(detectUrgency('URGENT: Besoin aide', 'Merci')).toBe(true)
      expect(detectUrgency('Question', 'C\'est bloquant')).toBe(true)
      expect(detectUrgency('Bonjour', 'Simple question')).toBe(false)
    })
  })

  describe('Email Domain Extraction', () => {
    it('should extract domain from email address', () => {
      const extractDomain = (email: string): string => {
        const match = email.match(/@([^@]+)$/)
        return match ? match[1].toLowerCase() : ''
      }
      
      expect(extractDomain('user@company.com')).toBe('company.com')
      expect(extractDomain('test@subdomain.example.org')).toBe('subdomain.example.org')
      expect(extractDomain('invalid')).toBe('')
    })
  })

  describe('Email Attachment Handling', () => {
    it('should detect attachment type', () => {
      const getAttachmentType = (filename: string): string => {
        const ext = filename.split('.').pop()?.toLowerCase()
        const types: Record<string, string> = { pdf: 'document', doc: 'document', xlsx: 'spreadsheet', png: 'image', jpg: 'image' }
        return types[ext || ''] || 'other'
      }
      
      expect(getAttachmentType('contrat.pdf')).toBe('document')
      expect(getAttachmentType('budget.xlsx')).toBe('spreadsheet')
      expect(getAttachmentType('photo.jpg')).toBe('image')
    })

    it('should validate attachment size', () => {
      const MAX_SIZE = 25 * 1024 * 1024
      const isValidSize = (size: number): boolean => size > 0 && size <= MAX_SIZE
      
      expect(isValidSize(1024)).toBe(true)
      expect(isValidSize(30 * 1024 * 1024)).toBe(false)
    })
  })

  describe('Email Content Processing', () => {
    it('should strip HTML tags from email body', () => {
      const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
      
      expect(stripHtml('<p>Hello <strong>World</strong></p>')).toBe('Hello World')
      expect(stripHtml('Plain text')).toBe('Plain text')
    })

    it('should truncate email preview', () => {
      const truncatePreview = (text: string, maxLength: number = 100): string => {
        if (text.length <= maxLength) return text
        return text.slice(0, maxLength - 3) + '...'
      }
      
      expect(truncatePreview('Short text')).toBe('Short text')
      expect(truncatePreview('A'.repeat(150), 100)).toHaveLength(100)
    })
  })
})
