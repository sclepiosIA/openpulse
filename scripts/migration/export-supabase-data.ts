/**
 * Script d'export des données Supabase
 * 
 * Usage:
 *   npx tsx scripts/migration/export-supabase-data.ts
 * 
 * Requis:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY is required');
  process.exit(1);
}

// Liste des tables à exporter (dans l'ordre pour respecter les dépendances)
const TABLES = [
  // Tables de base sans dépendances
  'categories_taches',
  'modeles_taches',
  
  // Utilisateurs et profils
  'profiles',
  'profiles_secrets',
  'user_roles',
  
  // Entités principales
  'groupes_etablissements',
  'partenaires',
  'etablissements',
  
  // Contacts et relations
  'contacts',
  'contacts_history',
  
  // Tâches
  'taches',
  'taches_documents',
  'taches_commentaires',
  
  // Email
  'user_email_accounts',
  'email_threads',
  'email_messages',
  'email_attachments',
  'email_drafts',
  'email_domain_mappings',
  'email_specific_mappings',
  'email_to_etablissement_suggestions',
  'email_templates',
  'email_filters',
  
  // RH
  'rh_salaires_mensuels',
  'rh_documents',
  'rh_absences',
  'rh_onboarding_offboarding',
  
  // Trésorerie
  'tresorerie_revenus',
  'tresorerie_depenses',
  'tresorerie_operations_bancaires',
  'tresorerie_categories',
  
  // R&D
  'rd_projets',
  'rd_epics',
  'rd_sprints',
  'rd_user_stories',
  'rd_tasks',
  'rd_attachments',
  
  // Formations
  'formation_sessions',
  'formation_emargements',
  'etablissement_users',
  'enquetes_satisfaction_formation',
  'enquetes_satisfaction_solution',
  
  // Support
  'support_tickets',
  
  // Notifications
  'push_subscriptions',
  'in_app_notifications',
  
  // Logs et analytics
  'security_logs',
  'ai_processing_log',
  'ai_suggested_actions',
  'email_sync_logs',
  
  // Customer success
  'customer_health_metrics',
  'customer_activities',
];

// Créer le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Répertoire de sortie
const OUTPUT_DIR = path.join(process.cwd(), 'exports', new Date().toISOString().split('T')[0]);

async function exportTable(tableName: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log(`📦 Exporting ${tableName}...`);
    
    // Récupérer toutes les données
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
      return { success: false, count: 0, error: error.message };
    }
    
    const count = data?.length || 0;
    
    // Sauvegarder en JSON
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${tableName}.json`),
      JSON.stringify(data, null, 2)
    );
    
    console.log(`  ✅ Exported ${count} rows`);
    return { success: true, count };
  } catch (error: any) {
    console.error(`  ❌ Exception: ${error.message}`);
    return { success: false, count: 0, error: error.message };
  }
}

async function exportUsers(): Promise<void> {
  console.log('\n📦 Exporting auth.users...');
  
  try {
    // Utiliser l'API Admin pour récupérer les utilisateurs
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY!
        }
      }
    );
    
    if (!response.ok) {
      console.error(`  ❌ HTTP error: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    const users = data.users || data;
    
    // Sauvegarder (ATTENTION: contient des données sensibles)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '_auth_users.json'),
      JSON.stringify(users, null, 2)
    );
    
    console.log(`  ✅ Exported ${users.length} users`);
    console.log(`  ⚠️  WARNING: This file contains sensitive data!`);
  } catch (error: any) {
    console.error(`  ❌ Exception: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting Supabase data export...\n');
  console.log(`📁 Output directory: ${OUTPUT_DIR}\n`);
  
  // Créer le répertoire de sortie
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Export des utilisateurs auth
  await exportUsers();
  
  // Export des tables
  const results: { table: string; success: boolean; count: number; error?: string }[] = [];
  
  for (const table of TABLES) {
    const result = await exportTable(table);
    results.push({ table, ...result });
    
    // Pause pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Résumé
  console.log('\n' + '='.repeat(50));
  console.log('📊 Export Summary');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalRows = successful.reduce((sum, r) => sum + r.count, 0);
  
  console.log(`✅ Successful: ${successful.length} tables`);
  console.log(`❌ Failed: ${failed.length} tables`);
  console.log(`📦 Total rows: ${totalRows.toLocaleString()}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed tables:');
    failed.forEach(r => console.log(`   - ${r.table}: ${r.error}`));
  }
  
  // Sauvegarder le manifest
  const manifest = {
    exportDate: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    tables: results,
    summary: {
      successful: successful.length,
      failed: failed.length,
      totalRows,
    }
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log(`\n📁 Export completed: ${OUTPUT_DIR}`);
}

main().catch(console.error);
