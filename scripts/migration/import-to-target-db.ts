/**
 * Script d'Import vers Base de Données Cible
 * Supporte PostgreSQL et MySQL
 * 
 * Usage:
 * npx ts-node scripts/migration/import-to-target-db.ts --type=postgresql --host=localhost --database=marque
 * npx ts-node scripts/migration/import-to-target-db.ts --type=mysql --host=localhost --database=marque
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Types
interface ImportConfig {
  type: 'postgresql' | 'mysql';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  dataDir: string;
  batchSize: number;
}

interface TableData {
  table: string;
  count: number;
  data: any[];
}

// Parse des arguments
function parseArgs(): Partial<ImportConfig> {
  const args: Partial<ImportConfig> = {};
  
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.replace('--', '').split('=');
    switch (key) {
      case 'type':
        args.type = value as 'postgresql' | 'mysql';
        break;
      case 'host':
        args.host = value;
        break;
      case 'port':
        args.port = parseInt(value);
        break;
      case 'database':
        args.database = value;
        break;
      case 'user':
        args.user = value;
        break;
      case 'password':
        args.password = value;
        break;
      case 'data-dir':
        args.dataDir = value;
        break;
      case 'batch-size':
        args.batchSize = parseInt(value);
        break;
    }
  });
  
  return args;
}

// Prompt interactif pour le mot de passe
async function promptPassword(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('Mot de passe de la base de données: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Connexion PostgreSQL
async function connectPostgreSQL(config: ImportConfig) {
  const { Pool } = await import('pg');
  
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
  });
  
  // Test de connexion
  const client = await pool.connect();
  console.log('✅ Connecté à PostgreSQL');
  client.release();
  
  return pool;
}

// Connexion MySQL
async function connectMySQL(config: ImportConfig) {
  const mysql = await import('mysql2/promise');
  
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    waitForConnections: true,
    connectionLimit: 10,
  });
  
  // Test de connexion
  const connection = await pool.getConnection();
  console.log('✅ Connecté à MySQL');
  connection.release();
  
  return pool;
}

// Ordre d'import (respecte les foreign keys)
const IMPORT_ORDER = [
  'profiles',
  'user_roles',
  'groupes_etablissements',
  'partenaires',
  'etablissements',
  'etablissements_groupes',
  'contacts',
  'categories_taches',
  'taches',
  'user_email_accounts',
  'email_threads',
  'email_messages',
  'email_attachments',
  'rh_employees',
  'rh_salaires_mensuels',
  'rh_absences',
  'rh_onboarding_offboarding',
  'tresorerie_revenus',
  'tresorerie_depenses',
  'tresorerie_operations_bancaires',
  'support_tickets',
  'rd_projets',
  'rd_epics',
  'rd_sprints',
  'rd_user_stories',
  'rd_tasks',
  'formation_sessions',
  'etablissement_users',
  'push_subscriptions',
  'notifications_in_app',
];

// Transformation des données pour MySQL
function transformForMySQL(table: string, row: any): any {
  const transformed = { ...row };
  
  // Convertir les tableaux en JSON strings
  Object.keys(transformed).forEach(key => {
    if (Array.isArray(transformed[key])) {
      transformed[key] = JSON.stringify(transformed[key]);
    }
    // Convertir les objets en JSON strings
    if (transformed[key] && typeof transformed[key] === 'object' && !(transformed[key] instanceof Date)) {
      transformed[key] = JSON.stringify(transformed[key]);
    }
    // Convertir les booléens en 0/1
    if (typeof transformed[key] === 'boolean') {
      transformed[key] = transformed[key] ? 1 : 0;
    }
  });
  
  return transformed;
}

// Import PostgreSQL
async function importPostgreSQL(pool: any, config: ImportConfig): Promise<void> {
  console.log('\n📥 Import vers PostgreSQL...\n');
  
  for (const table of IMPORT_ORDER) {
    const filePath = path.join(config.dataDir, `${table}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⏭️  ${table}: fichier non trouvé, ignoré`);
      continue;
    }
    
    const tableData: TableData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (tableData.data.length === 0) {
      console.log(`⏭️  ${table}: aucune donnée`);
      continue;
    }
    
    console.log(`📦 ${table}: ${tableData.count} enregistrements...`);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Désactiver les triggers temporairement
      await client.query(`ALTER TABLE ${table} DISABLE TRIGGER ALL`);
      
      // Import par batch
      for (let i = 0; i < tableData.data.length; i += config.batchSize) {
        const batch = tableData.data.slice(i, i + config.batchSize);
        
        for (const row of batch) {
          const columns = Object.keys(row);
          const values = Object.values(row);
          const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
          
          const query = `
            INSERT INTO ${table} (${columns.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `;
          
          await client.query(query, values);
        }
        
        process.stdout.write(`\r   Progression: ${Math.min(i + config.batchSize, tableData.data.length)}/${tableData.data.length}`);
      }
      
      // Réactiver les triggers
      await client.query(`ALTER TABLE ${table} ENABLE TRIGGER ALL`);
      
      await client.query('COMMIT');
      console.log(` ✅`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.log(` ❌`);
      console.error(`   Erreur: ${error}`);
    } finally {
      client.release();
    }
  }
}

// Import MySQL
async function importMySQL(pool: any, config: ImportConfig): Promise<void> {
  console.log('\n📥 Import vers MySQL...\n');
  
  // Désactiver les foreign keys
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  
  for (const table of IMPORT_ORDER) {
    const filePath = path.join(config.dataDir, `${table}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⏭️  ${table}: fichier non trouvé, ignoré`);
      continue;
    }
    
    const tableData: TableData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (tableData.data.length === 0) {
      console.log(`⏭️  ${table}: aucune donnée`);
      continue;
    }
    
    console.log(`📦 ${table}: ${tableData.count} enregistrements...`);
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Import par batch
      for (let i = 0; i < tableData.data.length; i += config.batchSize) {
        const batch = tableData.data.slice(i, i + config.batchSize);
        
        for (const row of batch) {
          const transformed = transformForMySQL(table, row);
          const columns = Object.keys(transformed);
          const values = Object.values(transformed);
          const placeholders = columns.map(() => '?').join(', ');
          
          const query = `
            INSERT IGNORE INTO ${table} (${columns.join(', ')})
            VALUES (${placeholders})
          `;
          
          await connection.query(query, values);
        }
        
        process.stdout.write(`\r   Progression: ${Math.min(i + config.batchSize, tableData.data.length)}/${tableData.data.length}`);
      }
      
      await connection.commit();
      console.log(` ✅`);
      
    } catch (error) {
      await connection.rollback();
      console.log(` ❌`);
      console.error(`   Erreur: ${error}`);
    } finally {
      connection.release();
    }
  }
  
  // Réactiver les foreign keys
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

// Mise à jour des séquences PostgreSQL
async function updatePostgreSQLSequences(pool: any): Promise<void> {
  console.log('\n🔄 Mise à jour des séquences PostgreSQL...');
  
  const client = await pool.connect();
  
  try {
    // Récupérer toutes les séquences
    const { rows: sequences } = await client.query(`
      SELECT 
        t.relname as table_name,
        a.attname as column_name,
        pg_get_serial_sequence(t.relname::text, a.attname::text) as sequence_name
      FROM pg_class t
      JOIN pg_attribute a ON a.attrelid = t.oid
      JOIN pg_attrdef d ON d.adrelid = t.oid AND d.adnum = a.attnum
      WHERE t.relkind = 'r'
        AND pg_get_serial_sequence(t.relname::text, a.attname::text) IS NOT NULL
    `);
    
    for (const seq of sequences) {
      if (seq.sequence_name) {
        await client.query(`
          SELECT setval('${seq.sequence_name}', COALESCE((SELECT MAX(${seq.column_name}) FROM ${seq.table_name}), 1))
        `);
      }
    }
    
    console.log('✅ Séquences mises à jour');
  } finally {
    client.release();
  }
}

// Vérification post-import
async function verifyImport(pool: any, config: ImportConfig): Promise<void> {
  console.log('\n🔍 Vérification de l\'import...\n');
  
  let errors = 0;
  
  for (const table of IMPORT_ORDER) {
    const filePath = path.join(config.dataDir, `${table}.json`);
    
    if (!fs.existsSync(filePath)) continue;
    
    const tableData: TableData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    try {
      let result;
      if (config.type === 'postgresql') {
        result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        result = result.rows[0].count;
      } else {
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        result = rows[0].count;
      }
      
      const expected = tableData.count;
      const actual = parseInt(result);
      
      if (actual === expected) {
        console.log(`✅ ${table}: ${actual}/${expected} enregistrements`);
      } else if (actual > 0) {
        console.log(`⚠️  ${table}: ${actual}/${expected} enregistrements (différence: ${expected - actual})`);
      } else {
        console.log(`❌ ${table}: ${actual}/${expected} enregistrements`);
        errors++;
      }
    } catch (error) {
      console.log(`❌ ${table}: erreur de vérification`);
      errors++;
    }
  }
  
  console.log(`\n${errors === 0 ? '✅' : '⚠️'} Vérification terminée avec ${errors} erreur(s)`);
}

// Point d'entrée
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   OPENPULSE IA - Import vers Base de Données Cible');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const args = parseArgs();
  
  // Configuration par défaut
  const config: ImportConfig = {
    type: args.type || 'postgresql',
    host: args.host || 'localhost',
    port: args.port || (args.type === 'mysql' ? 3306 : 5432),
    database: args.database || 'marque_db',
    user: args.user || 'marque',
    password: args.password || await promptPassword(),
    dataDir: args.dataDir || './migration-export',
    batchSize: args.batchSize || 100,
  };
  
  console.log(`\n📋 Configuration:`);
  console.log(`   Type: ${config.type}`);
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  console.log(`   Data Dir: ${config.dataDir}`);
  console.log(`   Batch Size: ${config.batchSize}`);
  
  // Vérifier que le répertoire de données existe
  if (!fs.existsSync(config.dataDir)) {
    console.error(`\n❌ Répertoire de données non trouvé: ${config.dataDir}`);
    console.error(`   Exécutez d'abord: npx ts-node scripts/migration/export-supabase-data.ts`);
    process.exit(1);
  }
  
  let pool;
  
  try {
    // Connexion
    if (config.type === 'postgresql') {
      pool = await connectPostgreSQL(config);
      await importPostgreSQL(pool, config);
      await updatePostgreSQLSequences(pool);
    } else {
      pool = await connectMySQL(config);
      await importMySQL(pool, config);
    }
    
    // Vérification
    await verifyImport(pool, config);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   ✅ IMPORT TERMINÉ AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

main();
