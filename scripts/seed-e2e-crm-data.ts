/**
 * Seed minimal CRM data pour l'admin E2E sandbox.
 *
 * Provisionne (idempotent, tag `e2e-admin-seed` dans les notes) :
 *   - 1 établissement (Contractuel)
 *   - 2 contacts liés (principal + DPO)
 *   - 1 contrat licence signé
 *
 * Prérequis :
 *   - Utilisateur `e2e-admin@exploitant.example.org` déjà créé via seed-e2e-users.ts
 *   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en env
 *
 * Usage :
 *   SUPABASE_SERVICE_ROLE_KEY=... bun run scripts/seed-e2e-crm-data.ts
 *
 * Ne modifie AUCUNE donnée existante hors des enregistrements taggés
 * `[e2e-admin-seed]` dans les notes / titres.
 */
import '../tests/support/ws-polyfill';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'test-admin@exploitant.example.org';
const SEED_TAG = '[e2e-admin-seed]';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAdminProfileId(): Promise<string> {
  const { data, error } = await sb
    .from('profiles')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();
  if (error) throw new Error(`profiles lookup: ${error.message}`);
  if (!data) throw new Error(`Admin ${ADMIN_EMAIL} introuvable — exécute seed-e2e-users.ts d'abord`);
  return data.id;
}

async function upsertEtablissement(adminId: string): Promise<string> {
  const existing = await sb
    .from('etablissements')
    .select('id')
    .ilike('notes', `%${SEED_TAG}%`)
    .limit(1)
    .maybeSingle();
  if (existing.data?.id) {
    console.log(`  ♻️  etablissement existant ${existing.data.id}`);
    return existing.data.id;
  }
  const { data, error } = await sb
    .from('etablissements')
    .insert({
      nom: 'CH Sandbox E2E',
      type: 'CH',
      ville: 'Paris',
      region: 'Île-de-France',
      code_postal: '75001',
      adresse: '1 rue de la Sandbox',
      email: 'contact-e2e@sandbox.local',
      statut: 'Contractuel',
      date_signature: new Date().toISOString().slice(0, 10),
      type_offre: 'Licence Standard',
      nombre_licences: 10,
      progression: 100,
      commercial_id: adminId,
      chef_projet_id: adminId,
      csm_id: adminId,
      notes: `${SEED_TAG} Compte sandbox pour tests RBAC admin — ne pas supprimer.`,
    })
    .select('id')
    .single();
  if (error) throw new Error(`etablissement: ${error.message}`);
  console.log(`  ✅ etablissement créé ${data.id}`);
  return data.id;
}

async function upsertContacts(etablissementId: string): Promise<string> {
  const existing = await sb
    .from('contacts')
    .select('id, type_contact')
    .eq('etablissement_id', etablissementId);
  if (existing.data && existing.data.length >= 2) {
    console.log(`  ♻️  contacts existants (${existing.data.length})`);
    return existing.data[0].id;
  }
  const rows = [
    {
      etablissement_id: etablissementId,
      nom: 'Sandbox',
      prenom: 'Principal',
      fonction: 'Directeur',
      email: 'principal-e2e@sandbox.local',
      est_contact_principal: true,
      type_contact: 'principal',
    },
    {
      etablissement_id: etablissementId,
      nom: 'Sandbox',
      prenom: 'DPO',
      fonction: 'Délégué à la protection des données',
      email: 'dpo-e2e@sandbox.local',
      est_contact_principal: false,
      type_contact: 'dpo',
    },
  ];
  const { data, error } = await sb.from('contacts').insert(rows).select('id');
  if (error) throw new Error(`contacts: ${error.message}`);
  console.log(`  ✅ ${data.length} contacts créés`);
  return data[0].id;
}

async function upsertContrat(etablissementId: string, contactId: string) {
  const existing = await sb
    .from('contrats')
    .select('id')
    .eq('etablissement_id', etablissementId)
    .ilike('titre', `%${SEED_TAG}%`)
    .maybeSingle();
  if (existing.data?.id) {
    console.log(`  ♻️  contrat existant ${existing.data.id}`);
    return;
  }
  const now = new Date();
  const { data, error } = await sb
    .from('contrats')
    .insert({
      titre: `${SEED_TAG} Contrat Licence Sandbox`,
      etablissement_id: etablissementId,
      contact_id: contactId,
      client_nom: 'CH Sandbox E2E',
      type: 'licence',
      statut: 'signe',
      date_debut: now.toISOString(),
      date_fin: new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString(),
      date_signature: now.toISOString(),
      montant_annuel_ht: 12000,
      montant_mensuel_ht: 1000,
      duree_initiale_mois: 12,
    })
    .select('id')
    .single();
  if (error) throw new Error(`contrat: ${error.message}`);
  console.log(`  ✅ contrat créé ${data.id}`);
}

async function main() {
  console.log(`🌱 Seed CRM sandbox pour ${ADMIN_EMAIL} sur ${SUPABASE_URL}\n`);
  const adminId = await findAdminProfileId();
  const etabId = await upsertEtablissement(adminId);
  const contactId = await upsertContacts(etabId);
  await upsertContrat(etabId, contactId);
  console.log('\n✅ Seed CRM terminé.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
