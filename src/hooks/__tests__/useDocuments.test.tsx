import { describe, it, expect } from 'vitest'
import {
  formatFileSize,
  sanitizeFileName,
  classifyDocument,
  generateStoragePath,
  isAllowedExtension,
  isFileSizeValid,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
} from '@/lib/documentUtils'

describe('Document Management Utilities', () => {
  it('should validate file extensions', () => {
    expect(isAllowedExtension('document.pdf')).toBe(true)
    expect(isAllowedExtension('report.xlsx')).toBe(true)
    expect(isAllowedExtension('image.png')).toBe(true)
    expect(isAllowedExtension('script.exe')).toBe(false)
    expect(isAllowedExtension('file.bat')).toBe(false)
    expect(isAllowedExtension('malware.js')).toBe(false)
  })

  it('should validate file size limits', () => {
    expect(isFileSizeValid(1 * 1024 * 1024)).toBe(true)
    expect(isFileSizeValid(30 * 1024 * 1024)).toBe(false)
  })

  it('should format file size correctly', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1048576)).toBe('1 MB')
    expect(formatFileSize(1073741824)).toBe('1 GB')
  })

  it('should sanitize file names', () => {
    expect(sanitizeFileName('My Document (1).pdf')).toBe('my_document_1_.pdf')
    expect(sanitizeFileName('Fichier été.docx')).toBe('fichier_t_.docx')
    expect(sanitizeFileName('test__file.xlsx')).toBe('test_file.xlsx')
  })
})

describe('Document Category Classification', () => {
  it('should classify document types correctly', () => {
    expect(classifyDocument('report.pdf')).toBe('document')
    expect(classifyDocument('data.xlsx')).toBe('spreadsheet')
    expect(classifyDocument('photo.png')).toBe('image')
    expect(classifyDocument('video.mp4')).toBe('video')
    expect(classifyDocument('unknown.xyz')).toBe('other')
  })
})

describe('Document Storage Path Generation', () => {
  it('should generate correct storage paths', () => {
    const path = generateStoragePath('etab-123', 'contrats', 'contrat.pdf')
    expect(path).toContain('etablissements/etab-123')
    expect(path).toContain('contrats')
    expect(path).toContain('contrat.pdf')
  })
})
