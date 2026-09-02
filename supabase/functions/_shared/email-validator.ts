import { z } from 'npm:zod@3.25.76';

/**
 * Schema de validation pour l'envoi d'emails
 * Utilisé pour valider les données côté serveur avant envoi
 */
export const emailSendSchema = z.object({
  to: z.array(z.string().email('Adresse email invalide')).min(1, 'Au moins un destinataire requis'),
  cc: z.array(z.string().email('Adresse email invalide')).optional(),
  bcc: z.array(z.string().email('Adresse email invalide')).optional(),
  subject: z.string().max(255, 'Le sujet ne peut pas dépasser 255 caractères'),
  body: z.string().max(500000, 'Le corps de l\'email ne peut pas dépasser 500KB'),
  attachments: z.array(z.object({
    filename: z.string(),
    size: z.number().max(25 * 1024 * 1024, 'La taille d\'une pièce jointe ne peut pas dépasser 25MB'),
    mime_type: z.string(),
    data: z.string(), // Base64 encoded
  })).optional(),
});

/**
 * Schema de validation pour les brouillons d'emails
 */
export const emailDraftSchema = z.object({
  to: z.string().optional(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().max(255).optional(),
  body: z.string().max(500000).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    size: z.number().max(25 * 1024 * 1024),
    mime_type: z.string(),
  })).optional(),
});

/**
 * Type inféré pour l'envoi d'emails
 */
export type EmailSendRequest = z.infer<typeof emailSendSchema>;

/**
 * Type inféré pour les brouillons
 */
export type EmailDraftRequest = z.infer<typeof emailDraftSchema>;

/**
 * Valide une requête d'envoi d'email
 * @throws {z.ZodError} Si la validation échoue
 */
export function validateEmailSend(data: unknown): EmailSendRequest {
  return emailSendSchema.parse(data);
}

/**
 * Valide une requête de brouillon d'email
 * @throws {z.ZodError} Si la validation échoue
 */
export function validateEmailDraft(data: unknown): EmailDraftRequest {
  return emailDraftSchema.parse(data);
}

/**
 * Calcule la taille totale des pièces jointes
 */
export function calculateTotalAttachmentSize(attachments?: Array<{ size: number }>): number {
  if (!attachments) return 0;
  return attachments.reduce((total, att) => total + att.size, 0);
}

/**
 * Valide la taille totale des pièces jointes (max 25MB)
 */
export function validateTotalAttachmentSize(attachments?: Array<{ size: number }>): boolean {
  const total = calculateTotalAttachmentSize(attachments);
  return total <= 25 * 1024 * 1024;
}

/**
 * Formate les erreurs de validation Zod pour l'utilisateur
 */
export function formatValidationErrors(error: z.ZodError): string {
  return error.errors
    .map(err => `${err.path.join('.')}: ${err.message}`)
    .join(', ');
}
