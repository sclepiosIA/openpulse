#!/usr/bin/env npx ts-node
/**
 * Bundle Size Checker
 * Analyse la taille du bundle après build et compare avec les seuils définis
 * Usage: npx ts-node scripts/check-bundle-size.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ChunkInfo {
  name: string;
  size: number;
  gzipSize: number;
}

interface BundleBaseline {
  timestamp: string;
  totalSize: number;
  totalGzip: number;
  chunks: Record<string, number>;
}

// Seuils en bytes (gzip)
const THRESHOLDS = {
  totalGzip: 800 * 1024,  // 800 KB total gzip
  totalRaw: 3 * 1024 * 1024, // 3 MB total raw
  chunks: {
    'react-core': 55 * 1024,     // 55 KB
    'supabase-core': 90 * 1024,  // 90 KB  
    'query-core': 35 * 1024,     // 35 KB
    'charts': 160 * 1024,        // 160 KB
    'index': 200 * 1024,         // 200 KB main chunk
  } as Record<string, number>,
};

const DIST_DIR = path.join(__dirname, '../dist/assets');
const BASELINE_PATH = path.join(__dirname, '../.bundle-baseline.json');

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateGzipSize(rawSize: number): number {
  // Estimation: gzip compresse généralement le JS de 60-70%
  return Math.round(rawSize * 0.35);
}

function getChunkCategory(filename: string): string {
  if (filename.includes('react') || filename.includes('React')) return 'react-core';
  if (filename.includes('supabase')) return 'supabase-core';
  if (filename.includes('query') || filename.includes('tanstack')) return 'query-core';
  if (filename.includes('recharts') || filename.includes('chart')) return 'charts';
  if (filename.startsWith('index-')) return 'index';
  return 'other';
}

function scanBundles(): ChunkInfo[] {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ dist/assets not found. Run `npm run build` first.');
    process.exit(1);
  }
  
  const files = fs.readdirSync(DIST_DIR);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  
  return jsFiles.map(file => {
    const fullPath = path.join(DIST_DIR, file);
    const stats = fs.statSync(fullPath);
    return {
      name: file,
      size: stats.size,
      gzipSize: estimateGzipSize(stats.size),
    };
  });
}

function loadBaseline(): BundleBaseline | null {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveBaseline(chunks: ChunkInfo[], totalSize: number, totalGzip: number) {
  const baseline: BundleBaseline = {
    timestamp: new Date().toISOString(),
    totalSize,
    totalGzip,
    chunks: chunks.reduce((acc, c) => {
      acc[c.name] = c.size;
      return acc;
    }, {} as Record<string, number>),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
}

function main() {
  console.log('📦 Bundle Size Analysis\n');
  console.log('─'.repeat(60));
  
  const chunks = scanBundles();
  const totalSize = chunks.reduce((sum, c) => sum + c.size, 0);
  const totalGzip = chunks.reduce((sum, c) => sum + c.gzipSize, 0);
  
  // Load baseline for comparison
  const baseline = loadBaseline();
  
  // Group by category
  const byCategory: Record<string, ChunkInfo[]> = {};
  for (const chunk of chunks) {
    const cat = getChunkCategory(chunk.name);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(chunk);
  }
  
  // Display results
  console.log('\n📊 Taille par catégorie:\n');
  
  const issues: string[] = [];
  
  for (const [category, categoryChunks] of Object.entries(byCategory)) {
    const catSize = categoryChunks.reduce((sum, c) => sum + c.size, 0);
    const catGzip = categoryChunks.reduce((sum, c) => sum + c.gzipSize, 0);
    const threshold = THRESHOLDS.chunks[category];
    
    let status = '✅';
    if (threshold && catGzip > threshold) {
      status = '⚠️';
      issues.push(`${category}: ${formatBytes(catGzip)} > ${formatBytes(threshold)}`);
    }
    
    console.log(`  ${status} ${category}: ${formatBytes(catSize)} (gzip: ~${formatBytes(catGzip)})`);
    
    // Show individual chunks in category
    for (const chunk of categoryChunks.slice(0, 3)) {
      console.log(`     └─ ${chunk.name}: ${formatBytes(chunk.size)}`);
    }
    if (categoryChunks.length > 3) {
      console.log(`     └─ ... et ${categoryChunks.length - 3} autres`);
    }
  }
  
  // Total summary
  console.log('\n─'.repeat(60));
  console.log(`\n📈 Total: ${formatBytes(totalSize)} (gzip: ~${formatBytes(totalGzip)})`);
  
  // Compare with baseline
  if (baseline) {
    const sizeDelta = totalSize - baseline.totalSize;
    const gzipDelta = totalGzip - baseline.totalGzip;
    const deltaSign = sizeDelta >= 0 ? '+' : '';
    const deltaColor = sizeDelta > 50 * 1024 ? '⚠️' : (sizeDelta < 0 ? '✅' : '➖');
    
    console.log(`   ${deltaColor} Delta depuis baseline: ${deltaSign}${formatBytes(sizeDelta)}`);
  }
  
  // Check thresholds
  console.log('\n📏 Vérification des seuils:\n');
  
  const totalGzipOk = totalGzip <= THRESHOLDS.totalGzip;
  const totalRawOk = totalSize <= THRESHOLDS.totalRaw;
  
  console.log(`  ${totalGzipOk ? '✅' : '❌'} Total gzip: ${formatBytes(totalGzip)} / ${formatBytes(THRESHOLDS.totalGzip)}`);
  console.log(`  ${totalRawOk ? '✅' : '❌'} Total raw: ${formatBytes(totalSize)} / ${formatBytes(THRESHOLDS.totalRaw)}`);
  
  // Final status
  console.log('\n─'.repeat(60));
  
  if (issues.length > 0) {
    console.log('\n⚠️  Chunks dépassant les seuils:');
    for (const issue of issues) {
      console.log(`   - ${issue}`);
    }
  }
  
  if (!totalGzipOk || !totalRawOk) {
    console.log('\n❌ Bundle trop volumineux! Considérer:');
    console.log('   - Code splitting (React.lazy)');
    console.log('   - Tree shaking des imports');
    console.log('   - Suppression de dépendances inutilisées');
    process.exit(1);
  }
  
  console.log('\n✅ Bundle size OK!');
  
  // Save as new baseline if requested
  if (process.argv.includes('--save-baseline')) {
    saveBaseline(chunks, totalSize, totalGzip);
    console.log(`\n💾 Baseline sauvegardée dans ${BASELINE_PATH}`);
  }
}

main();
