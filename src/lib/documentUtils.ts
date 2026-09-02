/**
 * Document management utility functions.
 * Extracted from business logic to enable proper unit testing.
 */

export const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

export function classifyDocument(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const classifications: Record<string, string> = {
    pdf: 'document',
    doc: 'document',
    docx: 'document',
    xls: 'spreadsheet',
    xlsx: 'spreadsheet',
    csv: 'spreadsheet',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    mp4: 'video',
    mp3: 'audio',
  };
  return classifications[ext || ''] || 'other';
}

export function generateStoragePath(
  etablissementId: string,
  category: string,
  filename: string
): string {
  const timestamp = Date.now();
  return `etablissements/${etablissementId}/${category}/${timestamp}_${filename}`;
}

export function isAllowedExtension(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function isFileSizeValid(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}
