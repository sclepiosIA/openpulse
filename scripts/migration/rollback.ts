/**
 * Script de Rollback de Migration
 * Permet de revenir à un état précédent en cas de problème
 * 
 * Usage:
 * npx ts-node scripts/migration/rollback.ts --backup=backup-2024-01-15.sql.gz
 * npx ts-node scripts/migration/rollback.ts --to-version=1.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Types
interface RollbackConfig {
  type: 'postgresql' | 'mysql';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  backupFile?: string;
  toVersion?: string;
  backupsDir: string;
  dryRun: boolean;
}

// Parse des arguments
function parseArgs(): Partial<RollbackConfig> {
  const args: Partial<RollbackConfig> = {};
  
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
      case 'backup':
        args.backupFile = value;
        break;
      case 'to-version':
        args.toVersion = value;
        break;
      case 'backups-dir':
        args.backupsDir = value;
        break;
      case 'dry-run':
        args.dryRun = value === 'true';
        break;
    }
  });
  
  return args;
}

// Prompt de confirmation
async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(`${message} (oui/non): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'oui' || answer.toLowerCase() === 'o');
    });
  });
}

// Liste les backups disponibles
function listAvailableBackups(backupsDir: string): string[] {
  if (!fs.existsSync(backupsDir)) {
    return [];
  }
  
  return fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.sql.gz') || f.endsWith('.sql'))
    .sort()
    .reverse();
}

// Crée un backup avant rollback
async function createPreRollbackBackup(config: RollbackConfig): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(config.backupsDir, `pre-rollback-${timestamp}.sql.gz`);
  
  console.log(`\n💾 Création d'un backup de sécurité: ${backupPath}`);
  
  if (config.dryRun) {
    console.log('   [DRY RUN] Backup simulé');
    return backupPath;
  }
  
  if (config.type === 'postgresql') {
    await execAsync(
      `PGPASSWORD="${config.password}" pg_dump -h ${config.host} -p ${config.port} -U ${config.user} ${config.database} | gzip > "${backupPath}"`
    );
  } else {
    await execAsync(
      `mysqldump -h ${config.host} -P ${config.port} -u ${config.user} -p"${config.password}" ${config.database} | gzip > "${backupPath}"`
    );
  }
  
  console.log(`   ✅ Backup créé`);
  return backupPath;
}

// Restaure un backup PostgreSQL
async function restorePostgreSQL(config: RollbackConfig, backupFile: string): Promise<void> {
  console.log(`\n🔄 Restauration PostgreSQL depuis ${backupFile}...`);
  
  if (config.dryRun) {
    console.log('   [DRY RUN] Restauration simulée');
    return;
  }
  
  // Décompresser si nécessaire
  let sqlFile = backupFile;
  if (backupFile.endsWith('.gz')) {
    console.log('   📦 Décompression...');
    const tempFile = backupFile.replace('.gz', '');
    await execAsync(`gunzip -c "${backupFile}" > "${tempFile}"`);
    sqlFile = tempFile;
  }
  
  try {
    // Terminer les connexions existantes
    console.log('   🔌 Fermeture des connexions...');
    await execAsync(
      `PGPASSWORD="${config.password}" psql -h ${config.host} -p ${config.port} -U ${config.user} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${config.database}' AND pid <> pg_backend_pid()"`
    ).catch(() => {});
    
    // Supprimer et recréer la base
    console.log('   🗑️ Suppression de la base existante...');
    await execAsync(
      `PGPASSWORD="${config.password}" dropdb -h ${config.host} -p ${config.port} -U ${config.user} --if-exists ${config.database}`
    );
    
    console.log('   📦 Création de la nouvelle base...');
    await execAsync(
      `PGPASSWORD="${config.password}" createdb -h ${config.host} -p ${config.port} -U ${config.user} ${config.database}`
    );
    
    // Restaurer
    console.log('   📥 Importation des données...');
    await execAsync(
      `PGPASSWORD="${config.password}" psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -f "${sqlFile}"`
    );
    
    // Nettoyer le fichier temporaire
    if (sqlFile !== backupFile) {
      fs.unlinkSync(sqlFile);
    }
    
    console.log('   ✅ Restauration terminée');
    
  } catch (error: any) {
    console.error(`   ❌ Erreur: ${error.message}`);
    throw error;
  }
}

// Restaure un backup MySQL
async function restoreMySQL(config: RollbackConfig, backupFile: string): Promise<void> {
  console.log(`\n🔄 Restauration MySQL depuis ${backupFile}...`);
  
  if (config.dryRun) {
    console.log('   [DRY RUN] Restauration simulée');
    return;
  }
  
  try {
    // Supprimer et recréer la base
    console.log('   🗑️ Suppression de la base existante...');
    await execAsync(
      `mysql -h ${config.host} -P ${config.port} -u ${config.user} -p"${config.password}" -e "DROP DATABASE IF EXISTS ${config.database}; CREATE DATABASE ${config.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`
    );
    
    // Restaurer
    console.log('   📥 Importation des données...');
    if (backupFile.endsWith('.gz')) {
      await execAsync(
        `gunzip -c "${backupFile}" | mysql -h ${config.host} -P ${config.port} -u ${config.user} -p"${config.password}" ${config.database}`
      );
    } else {
      await execAsync(
        `mysql -h ${config.host} -P ${config.port} -u ${config.user} -p"${config.password}" ${config.database} < "${backupFile}"`
      );
    }
    
    console.log('   ✅ Restauration terminée');
    
  } catch (error: any) {
    console.error(`   ❌ Erreur: ${error.message}`);
    throw error;
  }
}

// Vérification post-rollback
async function verifyRollback(config: RollbackConfig): Promise<boolean> {
  console.log('\n🔍 Vérification post-rollback...');
  
  if (config.dryRun) {
    console.log('   [DRY RUN] Vérification simulée');
    return true;
  }
  
  try {
    let result: string;
    
    if (config.type === 'postgresql') {
      const { stdout } = await execAsync(
        `PGPASSWORD="${config.password}" psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -t -c "SELECT COUNT(*) FROM etablissements"`
      );
      result = stdout.trim();
    } else {
      const { stdout } = await execAsync(
        `mysql -h ${config.host} -P ${config.port} -u ${config.user} -p"${config.password}" ${config.database} -N -e "SELECT COUNT(*) FROM etablissements"`
      );
      result = stdout.trim();
    }
    
    console.log(`   📊 Établissements: ${result} enregistrements`);
    
    // Vérifier d'autres tables critiques
    const criticalTables = ['profiles', 'taches', 'email_threads'];
    
    for (const table of criticalTables) {
      try {
        let count: string;
        if (config.type === 'postgresql') {
          const { stdout } = await execAsync(
            `PGPASSWORD="${config.password}" psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -t -c "SELECT COUNT(*) FROM ${table}"`
          );
          count = stdout.trim();
        } else {
          const { stdout } = await execAsync(
            `mysql -h ${config.host} -P ${config.port} -u ${config.user} -p"${config.password}" ${config.database} -N -e "SELECT COUNT(*) FROM ${table}"`
          );
          count = stdout.trim();
        }
        console.log(`   📊 ${table}: ${count} enregistrements`);
      } catch (error) {
        console.log(`   ⚠️ ${table}: table non trouvée`);
      }
    }
    
    console.log('   ✅ Vérification terminée');
    return true;
    
  } catch (error: any) {
    console.error(`   ❌ Erreur de vérification: ${error.message}`);
    return false;
  }
}

// Point d'entrée
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   OPENPULSE IA - Rollback de Migration');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const args = parseArgs();
  
  // Configuration
  const config: RollbackConfig = {
    type: args.type || 'postgresql',
    host: args.host || process.env.DB_HOST || 'localhost',
    port: args.port || (args.type === 'mysql' ? 3306 : 5432),
    database: args.database || process.env.DB_NAME || 'marque_db',
    user: args.user || process.env.DB_USER || 'marque',
    password: args.password || process.env.DB_PASSWORD || '',
    backupFile: args.backupFile,
    toVersion: args.toVersion,
    backupsDir: args.backupsDir || './backups',
    dryRun: args.dryRun || false,
  };
  
  // Demander le mot de passe si non fourni
  if (!config.password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    config.password = await new Promise((resolve) => {
      rl.question('Mot de passe de la base de données: ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
  
  console.log(`📋 Configuration:`);
  console.log(`   Type: ${config.type}`);
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   Backups Dir: ${config.backupsDir}`);
  console.log(`   Dry Run: ${config.dryRun}`);
  
  // Déterminer le fichier de backup à utiliser
  let backupToRestore = config.backupFile;
  
  if (!backupToRestore) {
    const availableBackups = listAvailableBackups(config.backupsDir);
    
    if (availableBackups.length === 0) {
      console.error('\n❌ Aucun backup disponible dans', config.backupsDir);
      process.exit(1);
    }
    
    console.log('\n📁 Backups disponibles:');
    availableBackups.forEach((backup, index) => {
      console.log(`   ${index + 1}. ${backup}`);
    });
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const choice = await new Promise<string>((resolve) => {
      rl.question('\nNuméro du backup à restaurer: ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
    
    const index = parseInt(choice) - 1;
    if (index < 0 || index >= availableBackups.length) {
      console.error('❌ Choix invalide');
      process.exit(1);
    }
    
    backupToRestore = path.join(config.backupsDir, availableBackups[index]);
  }
  
  // Vérifier que le fichier existe
  if (!fs.existsSync(backupToRestore)) {
    console.error(`\n❌ Fichier de backup non trouvé: ${backupToRestore}`);
    process.exit(1);
  }
  
  console.log(`\n📦 Backup sélectionné: ${backupToRestore}`);
  
  // Confirmation
  console.log('\n⚠️  ATTENTION: Cette opération va:');
  console.log('   1. Créer un backup de sécurité de l\'état actuel');
  console.log('   2. Supprimer la base de données actuelle');
  console.log('   3. Restaurer depuis le backup sélectionné');
  console.log('\n   Toutes les données actuelles seront perdues!');
  
  if (!config.dryRun) {
    const confirmed = await confirm('\nÊtes-vous sûr de vouloir continuer?');
    if (!confirmed) {
      console.log('\n❌ Opération annulée');
      process.exit(0);
    }
  }
  
  try {
    // Créer un backup de sécurité
    fs.mkdirSync(config.backupsDir, { recursive: true });
    await createPreRollbackBackup(config);
    
    // Restaurer
    if (config.type === 'postgresql') {
      await restorePostgreSQL(config, backupToRestore);
    } else {
      await restoreMySQL(config, backupToRestore);
    }
    
    // Vérifier
    const success = await verifyRollback(config);
    
    if (success) {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('   ✅ ROLLBACK TERMINÉ AVEC SUCCÈS');
      console.log('═══════════════════════════════════════════════════════\n');
    } else {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('   ⚠️ ROLLBACK TERMINÉ AVEC AVERTISSEMENTS');
      console.log('═══════════════════════════════════════════════════════\n');
    }
    
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    console.log('\n💡 Le backup de sécurité a été créé. Vous pouvez le restaurer manuellement.');
    process.exit(1);
  }
}

main();
