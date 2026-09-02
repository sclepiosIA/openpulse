/**
 * Domain-scoped type aliases over the auto-generated Supabase types.ts.
 * Action 180.2 (audit Fable 5) — mitigation OOM sur la couverture.
 *
 * Le fichier types.ts (34 281 lignes) ne peut pas être découpé (regen
 * atomique par la CLI Supabase). Ce module expose des alias étroits par
 * domaine ; les consommateurs importent ces alias au lieu de plonger dans
 * la Database complète, ce qui réduit la surface de types que TypeScript
 * doit résoudre par fichier.
 *
 * Exemple :
 *   import type { EmailThread, EmailMessage } from '@/integrations/supabase/typed';
 *   au lieu de
 *   import type { Database } from '@/integrations/supabase/types';
 *   type EmailThread = Database['public']['Tables']['email_threads']['Row'];
 */
import type { Database } from "./types";

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
type Insert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
type Update<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// --- Email domain --------------------------------------------------------
export type EmailThread = Row<"email_threads">;
export type EmailThreadInsert = Insert<"email_threads">;
export type EmailMessage = Row<"email_messages">;
export type EmailMessageInsert = Insert<"email_messages">;
export type UserEmailAccount = Row<"user_email_accounts">;

// --- CRM / Establishments ------------------------------------------------
export type Etablissement = Row<"etablissements">;
export type EtablissementInsert = Insert<"etablissements">;
export type EtablissementUpdate = Update<"etablissements">;
export type Contact = Row<"contacts">;

// --- HR ------------------------------------------------------------------
export type Profile = Row<"profiles">;
export type UserRole = Row<"user_roles">;
export type RhSalaireMensuel = Row<"rh_salaires_mensuels">;

// --- Treasury ------------------------------------------------------------
export type TresorerieRevenu = Row<"tresorerie_revenus">;
export type TresorerieDepense = Row<"tresorerie_depenses">;

// --- Support -------------------------------------------------------------
export type SupportTicket = Row<"support_tickets">;

// --- Calendar ------------------------------------------------------------
export type CalendarEvent = Row<"calendar_events">;
