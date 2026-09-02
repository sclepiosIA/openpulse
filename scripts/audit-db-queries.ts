#!/usr/bin/env npx ts-node
/**
 * Audit Script: Détecte les requêtes Supabase sans .limit() ou .range()
 * Usage: npx ts-node scripts/audit-db-queries.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface QueryIssue {
  file: string;
  line: number;
  table: string;
  code: string;
}

const HOOKS_DIR = path.join(__dirname, '../src/hooks');
const IGNORED_PATTERNS = [
  '.single()',     // Single row queries are OK
  '.maybeSingle()', // Maybe single queries are OK
  '.limit(',       // Already has limit
  '.range(',       // Already has range (pagination)
  'rpc(',          // RPC calls have their own limits
];

// Tables qui nécessitent absolument une limite
const CRITICAL_TABLES = [
  'etablissements',
  'taches',
  'candidates',
  'candidate_history',
  'candidate_evaluations',
  'candidate_interviews',
  'email_threads',
  'email_messages',
  'pulse_messages',
  'profiles',
];

function findQueryPatterns(content: string, filePath: string): QueryIssue[] {
  const issues: QueryIssue[] = [];
  const lines = content.split('\n');
  
  // Pattern pour détecter supabase.from('table').select(...)
  const fromSelectPattern = /\.from\(['"]([\w_]+)['"]\)\s*\.select\(/g;
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    let match;
    
    // Reset regex state
    fromSelectPattern.lastIndex = 0;
    
    while ((match = fromSelectPattern.exec(line)) !== null) {
      const table = match[1];
      
      // Skip if table is not critical
      if (!CRITICAL_TABLES.includes(table)) continue;
      
      // Check if this query has proper limiting
      // Look ahead in the next 10 lines for .limit(), .range(), .single(), etc.
      const queryContext = lines.slice(index, Math.min(index + 15, lines.length)).join('\n');
      
      const hasLimit = IGNORED_PATTERNS.some(pattern => queryContext.includes(pattern));
      
      if (!hasLimit) {
        issues.push({
          file: filePath,
          line: lineNum,
          table,
          code: line.trim().substring(0, 80) + (line.trim().length > 80 ? '...' : ''),
        });
      }
    }
  });
  
  return issues;
}

function scanDirectory(dir: string): QueryIssue[] {
  const issues: QueryIssue[] = [];
  
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return issues;
  }
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recurse into subdirectories
      issues.push(...scanDirectory(fullPath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      // Ignore test files
      if (file.includes('.test.') || file.includes('.spec.')) continue;
      
      const content = fs.readFileSync(fullPath, 'utf-8');
      const fileIssues = findQueryPatterns(content, fullPath);
      issues.push(...fileIssues);
    }
  }
  
  return issues;
}

function main() {
  console.log('🔍 Audit des requêtes DB sans .limit() ou .range()\n');
  console.log('Tables critiques surveillées:', CRITICAL_TABLES.join(', '));
  console.log('─'.repeat(60));
  
  const issues = scanDirectory(HOOKS_DIR);
  
  if (issues.length === 0) {
    console.log('\n✅ Aucun problème détecté! Toutes les requêtes critiques ont des limites.');
    process.exit(0);
  }
  
  console.log(`\n⚠️  ${issues.length} problème(s) détecté(s):\n`);
  
  // Group by file
  const byFile = issues.reduce((acc, issue) => {
    if (!acc[issue.file]) acc[issue.file] = [];
    acc[issue.file].push(issue);
    return acc;
  }, {} as Record<string, QueryIssue[]>);
  
  for (const [file, fileIssues] of Object.entries(byFile)) {
    const relativePath = path.relative(process.cwd(), file);
    console.log(`📄 ${relativePath}`);
    
    for (const issue of fileIssues) {
      console.log(`   L${issue.line}: Table "${issue.table}" - Ajouter .limit()`);
      console.log(`   └─ ${issue.code}`);
    }
    console.log();
  }
  
  console.log('─'.repeat(60));
  console.log('💡 Recommandation: Ajouter .limit() à ces requêtes pour éviter les fetches massifs.');
  console.log('   Limites suggérées:');
  console.log('   - etablissements, taches: 500');
  console.log('   - candidates: 200');
  console.log('   - candidate_history, evaluations, interviews: 50-100');
  
  // Exit with error code for CI
  process.exit(1);
}

main();
