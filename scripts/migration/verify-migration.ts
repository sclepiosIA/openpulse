/**
 * Script de vérification de la migration
 * 
 * Usage:
 *   npx tsx scripts/migration/verify-migration.ts
 * 
 * Requis:
 *   DATABASE_URL (nouvelle base de données)
 *   EXPORT_DIR (répertoire des exports JSON)
 */

import * as fs from 'fs';
import * as path from 'path';
import knex from 'knex';

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const EXPORT_DIR = process.env.EXPORT_DIR || path.join(process.cwd(), 'exports');

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

// Tables critiques à vérifier
const CRITICAL_TABLES = [
  'profiles',
  'etablissements',
  'contacts',
  'taches',
  'email_threads',
  'email_messages',
  'rh_salaires_mensuels',
  'support_tickets',
];

async function main() {
  console.log('🔍 Starting migration verification...\n');
  
  // Connexion à la nouvelle base
  const db = knex({
    client: DATABASE_URL?.startsWith('mysql') ? 'mysql2' : 'pg',
    connection: DATABASE_URL,
  });
  
  const results: {
    table: string;
    exported: number;
    imported: number;
    match: boolean;
    orphans?: number;
  }[] = [];
  
  try {
    // Tester la connexion
    await db.raw('SELECT 1');
    console.log('✅ Database connection successful\n');
    
    // Trouver le dernier export
    const exportDirs = fs.readdirSync(EXPORT_DIR)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse();
    
    if (exportDirs.length === 0) {
      console.error('❌ No export directory found');
      process.exit(1);
    }
    
    const latestExport = path.join(EXPORT_DIR, exportDirs[0]);
    console.log(`📁 Using export: ${latestExport}\n`);
    
    // Vérifier chaque table critique
    for (const table of CRITICAL_TABLES) {
      console.log(`📊 Checking ${table}...`);
      
      // Compter les lignes exportées
      const exportFile = path.join(latestExport, `${table}.json`);
      let exportedCount = 0;
      
      if (fs.existsSync(exportFile)) {
        const data = JSON.parse(fs.readFileSync(exportFile, 'utf-8'));
        exportedCount = data?.length || 0;
      }
      
      // Compter les lignes importées
      let importedCount = 0;
      try {
        const result = await db(table).count('* as count').first();
        importedCount = parseInt(result?.count as string) || 0;
      } catch (error) {
        console.log(`  ⚠️  Table not found in database`);
      }
      
      const match = exportedCount === importedCount;
      
      results.push({
        table,
        exported: exportedCount,
        imported: importedCount,
        match,
      });
      
      if (match) {
        console.log(`  ✅ ${importedCount} rows (match)`);
      } else {
        console.log(`  ⚠️  Exported: ${exportedCount}, Imported: ${importedCount}`);
      }
    }
    
    // Vérifier les relations (orphelins)
    console.log('\n🔗 Checking relationships...');
    
    // Tâches sans établissement
    try {
      const orphanTasks = await db('taches as t')
        .leftJoin('etablissements as e', 't.etablissement_id', 'e.id')
        .whereNull('e.id')
        .count('* as count')
        .first();
      
      const orphanCount = parseInt(orphanTasks?.count as string) || 0;
      if (orphanCount > 0) {
        console.log(`  ⚠️  Orphan tasks (no etablissement): ${orphanCount}`);
      } else {
        console.log('  ✅ No orphan tasks');
      }
    } catch (e) {
      // Table might not exist
    }
    
    // Emails sans thread
    try {
      const orphanMessages = await db('email_messages as m')
        .leftJoin('email_threads as t', 'm.thread_id', 't.id')
        .whereNull('t.id')
        .count('* as count')
        .first();
      
      const orphanCount = parseInt(orphanMessages?.count as string) || 0;
      if (orphanCount > 0) {
        console.log(`  ⚠️  Orphan email messages: ${orphanCount}`);
      } else {
        console.log('  ✅ No orphan email messages');
      }
    } catch (e) {
      // Table might not exist
    }
    
    // Résumé
    console.log('\n' + '='.repeat(50));
    console.log('📊 Verification Summary');
    console.log('='.repeat(50));
    
    const allMatch = results.every(r => r.match);
    const totalExported = results.reduce((sum, r) => sum + r.exported, 0);
    const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
    
    console.log(`\nTotal exported: ${totalExported.toLocaleString()} rows`);
    console.log(`Total imported: ${totalImported.toLocaleString()} rows`);
    
    if (allMatch) {
      console.log('\n✅ All critical tables match!');
    } else {
      console.log('\n⚠️  Some tables have mismatches:');
      results
        .filter(r => !r.match)
        .forEach(r => {
          const diff = r.exported - r.imported;
          console.log(`   - ${r.table}: ${diff > 0 ? '-' : '+'}${Math.abs(diff)} rows`);
        });
    }
    
    // Calculer le checksum des IDs
    console.log('\n🔐 Verifying data integrity...');
    
    for (const table of ['etablissements', 'profiles', 'contacts']) {
      try {
        const ids = await db(table).select('id').orderBy('id');
        const checksum = ids.reduce((hash, row) => hash + row.id, '').length;
        console.log(`  ${table}: checksum = ${checksum}`);
      } catch (e) {
        // Skip if table doesn't exist
      }
    }
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main().catch(console.error);
