// Native Deno.serve used below (no deprecated import)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

interface ImportContact {
  prenom: string;
  nom: string;
  email: string;
  fonction: string;
  telephone?: string;
}

interface ImportEtablissement {
  nom: string;
  region: string;
  prochaine_action: string;
  date_prochaine_action: string;
  contacts: ImportContact[];
}

interface ImportPartenaire {
  nom: string;
  type: string;
  sujet: string;
  prochaine_action: string;
  date_prochaine_action: string;
  contacts: ImportContact[];
}

const IMPORT_VERSION = '2026-03-15-r1';
const VALID_ETABLISSEMENT_TYPES = new Set(['CH', 'GHT', 'CHU', 'ESPIC', 'Privé']);

// Helper: infer etablissement type from name
function inferEtablissementType(nom: string | undefined | null): string {
  const n = (nom || '').toUpperCase();
  if (n.includes('CHU') || n.includes('CHRU')) return 'CHU';
  if (n.includes('GHT') || n.includes('GROUPEMENT')) return 'GHT';
  if (n.includes('ESPIC')) return 'ESPIC';
  if (n.includes('CLINIQUE') || n.includes('PRIVÉ') || n.includes('PRIVE') || n.includes('POLYCLINIQUE')) return 'Privé';
  return 'CH';
}

// Helper: map free-form partner type to valid constraint value
function mapPartnerType(type: string): string {
  const t = (type || '').toLowerCase();
  if (/ars|fhf|anap|fédéra|institu|ministère|agence|hôpital|public|fédération|dgos|has/.test(t)) return 'institutionnel';
  if (/cabinet|conseil|service|consult|avoc|audit|formation/.test(t)) return 'prestataire';
  return 'industriel';
}

// Helper: safe lowercase email
function safeEmail(email: string | undefined | null): string {
  return (email || '').toLowerCase().trim();
}

function formatDbError(error: { message?: string; code?: string; details?: string; hint?: string } | null): string {
  if (!error) return 'Unknown database error';
  const parts = [error.message, error.code ? `(code ${error.code})` : null, error.details, error.hint].filter(Boolean);
  return parts.join(' | ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Verify user auth
    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('[import-commercial-data] claims error', claimsError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;
    console.log('[import-commercial-data] authenticated user:', userId);

    // Use service role for inserts (bypass RLS)
    const db = createClient(supabaseUrl, supabaseServiceKey);

    // Server-side role check: direct query (bypasses PostgREST overload issue with has_role)
    const { data: roleData } = await db
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'direction']);

    const userRoles = (roleData || []).map((r: any) => r.role);
    const isAdmin = userRoles.includes('admin');
    const isDirection = userRoles.includes('direction');
    console.log('[import-commercial-data] roles:', { userRoles, isAdmin, isDirection });
    if (!isAdmin && !isDirection) {
      return new Response(JSON.stringify({ error: 'Rôle admin ou direction requis' }), { status: 403, headers: corsHeaders });
    }

    // Resolve profile ID from auth UID (profiles.id ≠ auth.users.id)
    const { data: profileData } = await db
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    const profileId = profileData?.id || null;
    console.log('[import-commercial-data] profile resolved:', { userId, profileId });

    if (!profileId) {
      return new Response(JSON.stringify({ error: 'Profil introuvable pour cet utilisateur' }), { status: 400, headers: corsHeaders });
    }

    const payload = await req.json();
    const tasksOnly = payload?.tasks_only === true;
    const etablissements = Array.isArray(payload?.etablissements) ? payload.etablissements as ImportEtablissement[] : [];
    const partenaires = Array.isArray(payload?.partenaires) ? payload.partenaires as ImportPartenaire[] : [];
    const commercial_category_id = payload?.commercial_category_id as string | undefined;

    const today = new Date().toISOString().split('T')[0];
    console.log(`[import-commercial-data:${IMPORT_VERSION}] start`, {
      etablissements: etablissements.length,
      partenaires: partenaires.length,
      userId,
    });

    const report = {
      etablissements_created: 0,
      etablissements_updated: 0,
      contacts_created: 0,
      contacts_skipped: 0,
      taches_created: 0,
      partenaires_created: 0,
      partenaires_contacts_created: 0,
      errors: [] as string[],
    };

    // ========== STEP 1: Etablissements ==========
    const { data: existingEtabs } = await db
      .from('etablissements')
      .select('id, nom');
    
    const etabNameMap = new Map<string, string>();
    (existingEtabs || []).forEach(e => {
      etabNameMap.set(e.nom.toLowerCase().trim(), e.id);
    });

    const { data: existingContacts } = await db
      .from('contacts')
      .select('id, email');
    
    const existingEmailSet = new Set<string>();
    (existingContacts || []).forEach(c => {
      if (c.email) existingEmailSet.add(safeEmail(c.email));
    });

    for (const etab of etablissements) {
      try {
        const etabNom = (etab?.nom || '').trim();
        if (!etabNom) {
          report.errors.push('Établissement ignoré: nom manquant');
          continue;
        }

        let etabId = etabNameMap.get(etabNom.toLowerCase());

        if (!etabId && !tasksOnly) {
          const inferredType = inferEtablissementType(etabNom);
          const safeType = VALID_ETABLISSEMENT_TYPES.has(inferredType) ? inferredType : 'CH';

          const insertPayload = {
            nom: etabNom,
            type: safeType,
            ville: 'Non renseignée',
            region: (etab.region || 'Non renseignée').trim() || 'Non renseignée',
            statut: 'Prospect',
            date_prise_contact: today,
            derniers_echanges_resume: etab.prochaine_action || null,
          };

          const { data: newEtab, error: createErr } = await db
            .from('etablissements')
            .insert(insertPayload)
            .select('id')
            .single();

          if (createErr) {
            report.errors.push(`Établissement "${etabNom}": ${formatDbError(createErr)} | payload.type=${insertPayload.type}`);
            console.error(`[import-commercial-data:${IMPORT_VERSION}] etablissement insert error`, { etabNom, insertPayload, createErr });
            continue;
          }
          etabId = newEtab.id;
          report.etablissements_created++;
        } else if (etabId && !tasksOnly) {
          await db
            .from('etablissements')
            .update({ derniers_echanges_resume: etab.prochaine_action })
            .eq('id', etabId);
          report.etablissements_updated++;
        }

        if (!etabId) {
          if (tasksOnly) report.errors.push(`Tâche ignorée pour "${etabNom}": établissement introuvable`);
          continue;
        }

        // Create contacts (skip in tasks_only mode)
        if (!tasksOnly) {
        for (const contact of (etab.contacts || [])) {
          const email = safeEmail(contact.email);
          if (!email || existingEmailSet.has(email)) {
            report.contacts_skipped++;
            continue;
          }
          
          const { error: contactErr } = await db
            .from('contacts')
            .insert({
              etablissement_id: etabId,
              prenom: contact.prenom,
              nom: contact.nom,
              email: contact.email,
              fonction: contact.fonction,
              telephone: contact.telephone || null,
            });
          
          if (contactErr) {
            if (contactErr.message?.includes('duplicate')) {
              report.contacts_skipped++;
            } else {
              report.errors.push(`Contact "${contact.email}": ${contactErr.message}`);
            }
          } else {
            existingEmailSet.add(email);
            report.contacts_created++;
          }
        }
        }

        // Create task for prochaine_action
        // statut enum: 'A faire', priorite enum: 'medium', no created_by column
        if (etab.prochaine_action && etab.date_prochaine_action) {
          const taskPayload = {
            titre: etab.prochaine_action.substring(0, 200),
            description: `[Import commercial] ${etab.nom}\n\n${etab.prochaine_action}`,
            statut: 'A faire',
            priorite: 'medium',
            echeance: etab.date_prochaine_action,
            etablissement_id: etabId,
            niveau_tache: 'etablissement',
            categorie_id: commercial_category_id || null,
            responsable_id: profileId,
          };
          console.log(`[import-commercial-data:${IMPORT_VERSION}] inserting etab task:`, JSON.stringify(taskPayload));
          const { error: taskErr } = await db
            .from('taches')
            .insert(taskPayload);
          
          if (taskErr) {
            report.errors.push(`Tâche "${etabNom}": ${formatDbError(taskErr)}`);
          } else {
            report.taches_created++;
          }
        }
      } catch (err: unknown) {
        report.errors.push(`Établissement (exception): ${String(err)}`);
      }
    }

    // ========== STEP 2: Partenaires ==========
    const { data: existingPartenaires } = await db
      .from('partenaires')
      .select('id, nom');
    
    const partenaireMap = new Map<string, string>();
    (existingPartenaires || []).forEach(p => {
      partenaireMap.set(p.nom.toLowerCase().trim(), p.id);
    });

    for (const partenaire of partenaires) {
      try {
        const partenaireNom = (partenaire?.nom || '').trim();
        if (!partenaireNom) {
          report.errors.push('Partenaire ignoré: nom manquant');
          continue;
        }

        let partenaireId = partenaireMap.get(partenaireNom.toLowerCase());

        if (!partenaireId) {
          const { data: newP, error: pErr } = await db
            .from('partenaires')
            .insert({
              nom: partenaireNom,
              type_partenaire: mapPartnerType(partenaire.type),
              notes: `${partenaire.sujet}\n\nProchaine action: ${partenaire.prochaine_action}`,
              created_by: userId,
            })
            .select('id')
            .single();

          if (pErr) {
            report.errors.push(`Partenaire "${partenaireNom}": ${formatDbError(pErr)}`);
            continue;
          }
          partenaireId = newP.id;
          report.partenaires_created++;
        }

        if (!partenaireId) {
          if (tasksOnly) report.errors.push(`Tâche ignorée pour partenaire "${partenaireNom}": introuvable`);
          continue;
        }

        // Create contacts (skip in tasks_only mode)
        if (!tasksOnly) {
        for (const contact of (partenaire.contacts || [])) {
          const email = safeEmail(contact.email);
          if (!email) continue;

          const { error: pcErr } = await db
            .from('partenaires_contacts')
            .insert({
              partenaire_id: partenaireId,
              prenom: contact.prenom,
              nom: contact.nom,
              email: contact.email,
              fonction: contact.fonction,
              telephone: contact.telephone || null,
            });

          if (pcErr) {
            if (!pcErr.message?.includes('duplicate')) {
              report.errors.push(`Contact partenaire "${contact.email}": ${formatDbError(pcErr)}`);
            }
          } else {
            report.partenaires_contacts_created++;
          }
        }
        }

        if (partenaire.prochaine_action && partenaire.date_prochaine_action) {
          const partTaskPayload = {
            titre: `[${partenaireNom}] ${partenaire.prochaine_action}`.substring(0, 200),
            description: `[Import commercial - Partenaire] ${partenaireNom}\n\n${partenaire.sujet}\n\nProchaine action: ${partenaire.prochaine_action}`,
            statut: 'A faire',
            priorite: 'medium',
            echeance: partenaire.date_prochaine_action,
            partenaire_id: partenaireId,
            niveau_tache: 'groupe',
            categorie_id: commercial_category_id || null,
            responsable_id: profileId,
          };
          console.log(`[import-commercial-data:${IMPORT_VERSION}] inserting partner task:`, JSON.stringify(partTaskPayload));
          const { error: taskErr } = await db
            .from('taches')
            .insert(partTaskPayload);

          if (!taskErr) {
            report.taches_created++;
          } else {
            report.errors.push(`Tâche partenaire "${partenaireNom}": ${formatDbError(taskErr)}`);
          }
        }
      } catch (err) {
        report.errors.push(`Partenaire (exception): ${String(err)}`);
      }
    }

    console.log(`[import-commercial-data:${IMPORT_VERSION}] done`, {
      errors: report.errors.length,
      etablissements_created: report.etablissements_created,
      etablissements_updated: report.etablissements_updated,
      taches_created: report.taches_created,
      partenaires_created: report.partenaires_created,
    });

    return new Response(
      JSON.stringify({ success: true, report }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return buildErrorResponse('import-commercial-data', error, corsHeaders, 500);
  }
});

