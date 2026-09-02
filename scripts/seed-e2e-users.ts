/**
 * Provisionne 5 comptes E2E avec rôles distincts dans Supabase.
 *
 * Prérequis (env) :
 *   SUPABASE_URL                  (ou VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY     (NE JAMAIS commit, fournir au runtime)
 *   E2E_PASSWORD_DEFAULT          (optionnel, défaut: "TestE2E!2026Marque")
 *
 * Usage :
 *   SUPABASE_SERVICE_ROLE_KEY=xxx bun run scripts/seed-e2e-users.ts
 *
 * Idempotent : si l'utilisateur existe déjà, on met juste à jour le mot de passe
 * et on s'assure que le rôle dans `user_roles` est correct.
 *
 * Une fois exécuté avec succès, exporter dans l'env CI :
 *   RUN_RBAC_MATRIX=true
 *   E2E_CSM_EMAIL / E2E_CSM_PASSWORD
 *   E2E_COMMERCIAL_EMAIL / E2E_COMMERCIAL_PASSWORD
 *   E2E_RH_EMAIL / E2E_RH_PASSWORD
 *   E2E_MANAGER_EMAIL / E2E_MANAGER_PASSWORD
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD
 */
// Polyfill WebSocket for Node < 22 (Supabase Realtime requirement).
// Must be imported before `@supabase/supabase-js`.
import '../tests/support/ws-polyfill';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = process.env.E2E_PASSWORD_DEFAULT || 'TestE2E!2026Marque';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  process.exit(1);
}

type Role = 'admin' | 'csm' | 'commercial' | 'rh' | 'manager' | 'user';

const ACCOUNTS: { email: string; role: Role; fullName: string }[] = [
  // Admin sandbox E2E — matche l'email attendu par les audits browser-use / RBAC.
  // Rôle réel `admin` (pas `direction`) → routes strictAdminOnly accessibles.
  // Idempotent : purge les autres rôles avant d'insérer `admin` (cf. upsertUser).
  { email: process.env.E2E_ADMIN_EMAIL || 'test-admin@exploitant.example.org', role: 'admin', fullName: 'E2E Admin' },
  { email: 'e2e-csm@marque-ia.test',        role: 'csm',        fullName: 'E2E CSM' },
  { email: 'e2e-commercial@marque-ia.test', role: 'commercial', fullName: 'E2E Commercial' },
  { email: 'e2e-rh@marque-ia.test',         role: 'rh',         fullName: 'E2E RH' },
  { email: 'e2e-manager@marque-ia.test',    role: 'manager',    fullName: 'E2E Manager' },
  { email: 'e2e-user@marque-ia.test',       role: 'user',       fullName: 'E2E User' },
];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email: string) {
  // listUsers est paginé — on cherche sur la 1re page (~50 users suffit pour tests)
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page++;
  }
  return null;
}

async function upsertUser(email: string, role: Role, fullName: string) {
  let user = await findUserByEmail(email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, e2e: true },
    });
    if (error) throw new Error(`create ${email}: ${error.message}`);
    user = data.user!;
    console.log(`  ✅ créé ${email}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: DEFAULT_PASSWORD,
      user_metadata: { ...(user.user_metadata || {}), full_name: fullName, e2e: true },
    });
    if (error) throw new Error(`update ${email}: ${error.message}`);
    console.log(`  ♻️  reset password ${email}`);
  }

  // Profile (idempotent). Pour l'admin sandbox on documente l'exemption 2FA :
  // `two_factor_enabled=true` + `two_factor_secret` fourni via env
  // `E2E_ADMIN_TOTP_SECRET` (jamais commit). Sans secret, on laisse la 2FA
  // désactivée : les routes admin restent accessibles (RouteGuard ne vérifie
  // que le rôle) mais les RLS `has_admin_role_strict` renvoient false.
  const adminTotp = process.env.E2E_ADMIN_TOTP_SECRET || null;
  const profilePatch: Record<string, unknown> = { id: user.id, email, full_name: fullName };
  if (role === 'admin') {
    profilePatch.two_factor_enabled = Boolean(adminTotp);
    profilePatch.actif = true;
  }
  const { error: profErr } = await admin
    .from('profiles')
    .upsert(profilePatch, { onConflict: 'id' });
  if (profErr) console.warn(`  ⚠️  profiles ${email}: ${profErr.message}`);

  if (role === 'admin' && adminTotp) {
    const { error: secErr } = await admin
      .from('profiles_secrets')
      .upsert(
        { user_id: user.id, two_factor_secret: adminTotp },
        { onConflict: 'user_id' }
      );
    if (secErr) console.warn(`  ⚠️  profiles_secrets ${email}: ${secErr.message}`);
  }

  // Role — purge puis insert (idempotent). Garantit qu'un ancien `direction`
  // hérité ne masque pas le rôle `admin` (résolution par priorité côté client).
  await admin.from('user_roles').delete().eq('user_id', user.id);
  const { error: roleErr } = await admin
    .from('user_roles')
    .insert({ user_id: user.id, role });
  if (roleErr) throw new Error(`role ${email}: ${roleErr.message}`);
}

async function main() {
  console.log(`🌱 Seed E2E users sur ${SUPABASE_URL}`);
  console.log(`   Mot de passe commun: ${DEFAULT_PASSWORD}\n`);

  for (const acc of ACCOUNTS) {
    console.log(`→ ${acc.role.padEnd(10)} ${acc.email}`);
    try {
      await upsertUser(acc.email, acc.role, acc.fullName);
    } catch (e) {
      console.error(`  ❌ ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }

  console.log('\n📋 Variables CI à exporter :');
  console.log('export RUN_RBAC_MATRIX=true');
  const adminAcc = ACCOUNTS.find((a) => a.role === 'admin')!;
  console.log(`export E2E_EMAIL="${adminAcc.email}"`);
  console.log(`export E2E_PASSWORD="${DEFAULT_PASSWORD}"`);
  console.log(`export E2E_ADMIN_EMAIL="${adminAcc.email}"`);
  console.log(`export E2E_ADMIN_PASSWORD="${DEFAULT_PASSWORD}"`);
  for (const acc of ACCOUNTS.filter((a) => a.role !== 'admin')) {
    const k = acc.role.toUpperCase();
    console.log(`export E2E_${k}_EMAIL="${acc.email}"`);
    console.log(`export E2E_${k}_PASSWORD="${DEFAULT_PASSWORD}"`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
