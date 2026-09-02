/**
 * Script d'import des données vers PostgreSQL self-hosted
 * Phase 3 : Migration depuis Supabase
 * 
 * Usage: npx ts-node scripts/migration/import-to-postgres.ts <export_dir>
 */

import * as fs from 'fs';
import * as path from 'path';
import knex, { Knex } from 'knex';

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const EXPORT_DIR = process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL environment variable');
  process.exit(1);
}

if (!EXPORT_DIR) {
  console.error('❌ Usage: npx ts-node import-to-postgres.ts <export_directory>');
  process.exit(1);
}

// Tables dans l'ordre d'import (respect des FK)
const IMPORT_ORDER = [
  // Auth (users doivent être créés séparément)
  'profiles',
  'user_roles',
  'profiles_secrets',
  
  // CRM - Level 0
  'groupes_etablissements',
  'partenaires',
  'categories_taches',
  
  // CRM - Level 1
  'etablissements',
  'modeles_taches',
  
  // CRM - Level 2
  'etablissements_groupes',
  'contacts',
  'taches',
  
  // CRM - Level 3
  'contacts_history',
  
  // Email - Level 0
  'user_email_accounts',
  
  // Email - Level 1
  'email_threads',
  'email_drafts',
  'email_domain_mappings',
  'email_specific_mappings',
  'email_filters',
  'email_templates',
  
  // Email - Level 2
  'email_messages',
  'email_to_etablissement_suggestions',
  'email_message_id_registry',
  
  // Email - Level 3
  'email_attachments',
  
  // Logs
  'email_sync_log',
  'email_sync_logs',
  'ai_processing_log',
  'ai_suggested_actions',
  'ai_analysis_log',
  
  // RH
  'rh_employes',
  'rh_salaires_mensuels',
  'rh_absences',
  'rh_documents',
  'rh_onboarding_offboarding',
  
  // Trésorerie
  'tresorerie_revenus',
  'tresorerie_depenses',
  'tresorerie_operations_bancaires',
  'tresorerie_journal_operations',
  'tresorerie_factures_workflow',
  'tresorerie_previsions',
  'tresorerie_qonto_connections',
  
  // R&D
  'rd_projets',
  'rd_epics',
  'rd_sprints',
  'rd_user_stories',
  'rd_tasks',
  'rd_attachments',
  
  // Support
  'support_tickets',
  
  // Notifications
  'notifications',
  'push_subscriptions',
  
  // Formation
  'formation_sessions',
  'etablissement_users',
  'formation_emargements',
  'etablissement_user_roles',
  'enquetes_satisfaction_formation',
  'enquetes_satisfaction_solution',
  
  // Calendrier
  'calendar_feed_tokens',
  'calendar_invitation_suggestions',
  
  // CSM
  'customer_health_metrics',
  'customer_activities',
  
  // Admin
  'authorized_ips',
  'blocked_ips',
  'system_config',
  'system_stats',
];

async function importTable(db: Knex, tableName: string, exportDir: string): Promise<{ success: boolean; count: number; error?: string }> {
  const filePath = path.join(exportDir, `${tableName}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`   ⏭️  Skipping ${tableName} (no export file)`);
    return { success: true, count: 0 };
  }
  
  try {
    console.log(`📥 Importing ${tableName}...`);
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`   ⏭️  Skipping ${tableName} (empty)`);
      return { success: true, count: 0 };
    }
    
    // Désactiver temporairement les contraintes FK
    await db.raw('SET session_replication_role = replica;');
    
    // Insérer par batch de 100
    const BATCH_SIZE = 100;
    let inserted = 0;
    
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      
      // Nettoyer les données (convertir les dates, etc.)
      const cleanedBatch = batch.map((row: any) => {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(row)) {
          if (value === null || value === undefined) {
            cleaned[key] = null;
          } else if (typeof value === 'object' && !Array.isArray(value)) {
            cleaned[key] = JSON.stringify(value);
          } else if (Array.isArray(value)) {
            // PostgreSQL arrays
            cleaned[key] = JSON.stringify(value);
          } else {
            cleaned[key] = value;
          }
        }
        return cleaned;
      });
      
      try {
        await db(tableName)
          .insert(cleanedBatch)
          .onConflict('id')
          .merge();
        inserted += cleanedBatch.length;
      } catch (err: any) {
        console.error(`   ⚠️  Batch error: ${err.message}`);
        // Essayer un par un pour identifier les problèmes
        for (const row of cleanedBatch) {
          try {
            await db(tableName).insert(row).onConflict('id').merge();
            inserted++;
          } catch (rowErr: any) {
            console.error(`      Row error (id=${row.id}): ${rowErr.message}`);
          }
        }
      }
    }
    
    // Réactiver les contraintes FK
    await db.raw('SET session_replication_role = DEFAULT;');
    
    console.log(`   ✅ Imported ${inserted}/${data.length} rows`);
    return { success: true, count: inserted };
  } catch (err: any) {
    console.error(`   ❌ Exception: ${err.message}`);
    return { success: false, count: 0, error: err.message };
  }
}

async function updateSequences(db: Knex) {
  console.log('\n🔄 Updating sequences...');
  
  // Pour les tables avec des colonnes serial, mettre à jour les séquences
  const tables = await db.raw(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE column_default LIKE 'nextval%' 
    AND table_schema = 'public'
  `);
  
  for (const row of tables.rows) {
    try {
      await db.raw(`
        SELECT setval(pg_get_serial_sequence('${row.table_name}', '${row.column_name}'), 
               COALESCE((SELECT MAX(${row.column_name}) FROM ${row.table_name}), 1), true)
      `);
    } catch (err) {
      // Ignorer les erreurs de séquence
    }
  }
  
  console.log('   ✅ Sequences updated');
}

async function main() {
  console.log('🚀 Starting PostgreSQL import...');
  console.log(`📁 Import from: ${EXPORT_DIR}`);
  console.log(`🔗 Database: ${DATABASE_URL?.split('@')[1] || 'configured'}`);
  
  // Vérifier que le dossier existe
  if (!fs.existsSync(EXPORT_DIR)) {
    console.error(`❌ Export directory not found: ${EXPORT_DIR}`);
    process.exit(1);
  }
  
  // Connexion à la base
  const db = knex({
    client: 'pg',
    connection: DATABASE_URL,
    pool: { min: 1, max: 5 },
  });
  
  try {
    // Tester la connexion
    await db.raw('SELECT 1');
    console.log('✅ Database connected\n');
    
    // Importer les tables
    const results: Record<string, { success: boolean; count: number; error?: string }> = {};
    
    for (const table of IMPORT_ORDER) {
      results[table] = await importTable(db, table, EXPORT_DIR);
    }
    
    // Mettre à jour les séquences
    await updateSequences(db);
    
    // Rapport final
    const successCount = Object.values(results).filter(r => r.success).length;
    const failCount = Object.values(results).filter(r => !r.success).length;
    const totalRows = Object.values(results).reduce((sum, r) => sum + r.count, 0);
    
    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Successful: ${successCount} tables`);
    console.log(`   ❌ Failed: ${failCount} tables`);
    console.log(`   📝 Total rows imported: ${totalRows}`);
    
    if (failCount > 0) {
      console.log('\n⚠️  Failed tables:');
      Object.entries(results)
        .filter(([_, r]) => !r.success)
        .forEach(([table, r]) => console.log(`   - ${table}: ${r.error}`));
    }
    
    // Sauvegarder le rapport
    fs.writeFileSync(
      path.join(EXPORT_DIR, '_import_report.json'),
      JSON.stringify({
        importDate: new Date().toISOString(),
        databaseUrl: DATABASE_URL?.split('@')[1],
        results,
        summary: { successCount, failCount, totalRows },
      }, null, 2)
    );
    
  } finally {
    await db.destroy();
  }
  
  console.log('\n✅ Import completed!');
}

main().catch(console.error);
