#!/usr/bin/env node

/**
 * Bundle Analysis Script for OpenPulse Client Compass
 * 
 * This script builds the application and generates a visual bundle analysis report.
 * It uses vite-plugin-visualizer to create an interactive HTML report showing:
 * - Bundle size breakdown by chunks
 * - Dependency sizes and relationships
 * - Tree shaking effectiveness
 * - Gzip/Brotli compression impact
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔍 Starting bundle analysis...\n');

// Step 1: Build the application
console.log('📦 Building application...');
const buildProcess = spawn('npm', ['run', 'build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Build failed with code', code);
    process.exit(1);
  }
  
  console.log('✅ Build completed successfully\n');
  
  // Step 2: Check if stats.html was generated
  const statsPath = join(projectRoot, 'dist', 'stats.html');
  
  if (existsSync(statsPath)) {
    console.log('📊 Bundle analysis report generated at: dist/stats.html');
    console.log('🌐 The report should open automatically in your browser');
    console.log('\n📋 Analysis includes:');
    console.log('   • Bundle size breakdown by chunks');
    console.log('   • Largest dependencies and modules');
    console.log('   • Tree shaking effectiveness');
    console.log('   • Gzip and Brotli compression impact');
    console.log('   • Interactive visualization of module relationships');
    
    console.log('\n💡 Tips for optimization:');
    console.log('   • Look for unexpectedly large chunks');
    console.log('   • Check for duplicate dependencies');
    console.log('   • Identify modules that could be lazy-loaded');
    console.log('   • Consider code splitting for large components');
  } else {
    console.warn('⚠️ Bundle analysis report not found at expected location');
    console.log('Check if vite-plugin-visualizer is properly configured in vite.config.ts');
  }
});

buildProcess.on('error', (error) => {
  console.error('❌ Failed to start build process:', error.message);
  process.exit(1);
});