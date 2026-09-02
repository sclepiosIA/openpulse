/**
 * Script pour remplacer automatiquement tous les console.log par debug.log
 * Ce script est exécuté une seule fois pour nettoyer le code de production
 */

import * as fs from 'fs';
import * as path from 'path';

const filesToProcess = [
  'src/pages/Dashboard.tsx',
  'src/pages/Parametres.tsx',
  'src/pages/Partenaires.tsx',
  'src/components/ResetProspectTasksButton.tsx',
  'src/hooks/useEmailFilters.ts',
  'src/hooks/useFormationAnalytics.ts',
  'src/lib/monitoring.ts',
  'src/lib/pwa-analytics.ts',
  'src/components/rh/UploadDocumentDialog.tsx',
  // Ajoutez d'autres fichiers au besoin
];

function replaceConsoleLogsInFile(filePath: string) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Vérifier si debug est déjà importé
    const hasDebugImport = content.includes("from '@/lib/debug'") || content.includes('from "@/lib/debug"');
    
    // Remplacer console.log par debug.log
    const consoleLogRegex = /console\.log\(/g;
    if (consoleLogRegex.test(content)) {
      content = content.replace(consoleLogRegex, 'debug.log(');
      modified = true;
    }

    // Remplacer console.warn par debug.warn
    const consoleWarnRegex = /console\.warn\(/g;
    if (consoleWarnRegex.test(content)) {
      content = content.replace(consoleWarnRegex, 'debug.warn(');
      modified = true;
    }

    // Remplacer console.info par debug.info
    const consoleInfoRegex = /console\.info\(/g;
    if (consoleInfoRegex.test(content)) {
      content = content.replace(consoleInfoRegex, 'debug.info(');
      modified = true;
    }

    // Ajouter l'import debug si nécessaire et si des modifications ont été faites
    if (modified && !hasDebugImport) {
      // Trouver la dernière ligne d'import
      const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
      if (importLines.length > 0) {
        const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1]);
        const insertPosition = content.indexOf('\n', lastImportIndex) + 1;
        content = content.slice(0, insertPosition) + "import { debug } from '@/lib/debug'\n" + content.slice(insertPosition);
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fichier traité: ${filePath}`);
    } else {
      console.log(`⏭️  Pas de modifications nécessaires: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Erreur lors du traitement de ${filePath}:`, error);
  }
}

console.log('🚀 Démarrage du nettoyage des console.log...\n');

filesToProcess.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    replaceConsoleLogsInFile(fullPath);
  } else {
    console.warn(`⚠️  Fichier introuvable: ${file}`);
  }
});

console.log('\n✨ Nettoyage terminé!');
