#!/usr/bin/env npx ts-node
/**
 * TypeScript Strict Mode Audit Script
 * Exécute tsc avec les règles strictes activées et génère un rapport
 * Usage: npx ts-node scripts/typescript-strict-audit.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ViolationSummary {
  noUnusedLocals: number;
  noUnusedParameters: number;
  other: number;
}

function runAudit() {
  console.log('🔍 Audit TypeScript Strict Mode\n');
  console.log('Vérification de: noUnusedLocals, noUnusedParameters');
  console.log('─'.repeat(60));
  
  // Create a temporary tsconfig with strict rules
  const tempConfigPath = path.join(__dirname, '../tsconfig.strict-audit.json');
  const strictConfig = {
    extends: './tsconfig.app.json',
    compilerOptions: {
      noUnusedLocals: true,
      noUnusedParameters: true,
      noEmit: true,
    },
    exclude: [
      'node_modules',
      'dist',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      'scripts',
    ],
  };
  
  fs.writeFileSync(tempConfigPath, JSON.stringify(strictConfig, null, 2));
  
  let output = '';
  let hasErrors = false;
  
  try {
    // Run TypeScript compiler with strict config
    execSync(`npx tsc --project ${tempConfigPath}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log('\n✅ Aucune violation détectée!');
  } catch (error: any) {
    hasErrors = true;
    output = error.stdout || error.stderr || '';
  } finally {
    // Cleanup temp config
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  }
  
  if (!hasErrors) {
    console.log('\n🎉 Le code est conforme aux règles strictes TypeScript!');
    return;
  }
  
  // Parse and categorize violations
  const lines = output.split('\n').filter(line => line.trim());
  const summary: ViolationSummary = {
    noUnusedLocals: 0,
    noUnusedParameters: 0,
    other: 0,
  };
  
  const violations: { file: string; message: string; type: string }[] = [];
  
  for (const line of lines) {
    // TS6133: 'x' is declared but its value is never read (noUnusedLocals)
    // TS6198: 'x' is declared but never used (noUnusedParameters for destructuring)
    if (line.includes('TS6133') || line.includes('declared but its value is never read')) {
      summary.noUnusedLocals++;
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+\w+:\s*(.+)$/);
      if (match) {
        violations.push({
          file: match[1],
          message: match[4],
          type: 'unused-local',
        });
      }
    } else if (line.includes('TS6198') || line.includes('declared but never used')) {
      summary.noUnusedParameters++;
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+\w+:\s*(.+)$/);
      if (match) {
        violations.push({
          file: match[1],
          message: match[4],
          type: 'unused-param',
        });
      }
    } else if (line.includes('error TS')) {
      summary.other++;
    }
  }
  
  // Output summary
  console.log(`\n📊 Résumé des violations:\n`);
  console.log(`  Variables non utilisées (noUnusedLocals): ${summary.noUnusedLocals}`);
  console.log(`  Paramètres non utilisés (noUnusedParameters): ${summary.noUnusedParameters}`);
  if (summary.other > 0) {
    console.log(`  Autres erreurs: ${summary.other}`);
  }
  
  const total = summary.noUnusedLocals + summary.noUnusedParameters + summary.other;
  console.log(`\n  Total: ${total} violation(s)`);
  
  // Group violations by file
  const byFile = violations.reduce((acc, v) => {
    const relPath = path.relative(process.cwd(), v.file);
    if (!acc[relPath]) acc[relPath] = [];
    acc[relPath].push(v);
    return acc;
  }, {} as Record<string, typeof violations>);
  
  // Show top 10 files with most violations
  const sortedFiles = Object.entries(byFile)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);
  
  if (sortedFiles.length > 0) {
    console.log('\n📄 Top 10 fichiers avec le plus de violations:\n');
    for (const [file, fileViolations] of sortedFiles) {
      console.log(`  ${file}: ${fileViolations.length} violation(s)`);
    }
  }
  
  console.log('\n─'.repeat(60));
  console.log('💡 Conseils pour corriger:');
  console.log('  - Variables non utilisées: Supprimer ou préfixer avec _');
  console.log('  - Paramètres non utilisés: Préfixer avec _ (ex: _event)');
  console.log('  - Après correction, activer les règles dans tsconfig.app.json');
  
  // Don't fail the script - this is informational
  console.log(`\n⚠️  Audit terminé avec ${total} violation(s) à corriger.`);
}

runAudit();
