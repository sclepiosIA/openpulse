/**
 * Script de Migration du Storage Supabase vers S3/MinIO
 * 
 * Usage:
 * npx ts-node scripts/migration/migrate-storage.ts --target=minio --endpoint=http://localhost:9000
 * npx ts-node scripts/migration/migrate-storage.ts --target=s3 --bucket=marque-storage --region=eu-west-3
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Types
interface MigrationConfig {
  target: 'minio' | 's3';
  endpoint?: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  outputDir: string;
}

interface BucketInfo {
  name: string;
  public: boolean;
  fileCount: number;
  totalSize: number;
}

interface FileInfo {
  bucket: string;
  path: string;
  size: number;
  mimeType: string;
}

// Parse des arguments
function parseArgs(): Partial<MigrationConfig> {
  const args: Partial<MigrationConfig> = {};
  
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.replace('--', '').split('=');
    switch (key) {
      case 'target':
        args.target = value as 'minio' | 's3';
        break;
      case 'endpoint':
        args.endpoint = value;
        break;
      case 'access-key':
        args.accessKey = value;
        break;
      case 'secret-key':
        args.secretKey = value;
        break;
      case 'bucket':
        args.bucket = value;
        break;
      case 'region':
        args.region = value;
        break;
      case 'output-dir':
        args.outputDir = value;
        break;
    }
  });
  
  return args;
}

// Client Supabase
function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Client S3/MinIO
async function getS3Client(config: MigrationConfig) {
  const { S3Client } = await import('@aws-sdk/client-s3');
  
  const clientConfig: any = {
    region: config.region || 'us-east-1',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  };
  
  // Configuration spécifique MinIO
  if (config.target === 'minio' && config.endpoint) {
    clientConfig.endpoint = config.endpoint;
    clientConfig.forcePathStyle = true;
  }
  
  return new S3Client(clientConfig);
}

// Liste des buckets Supabase
async function listSupabaseBuckets(supabase: any): Promise<BucketInfo[]> {
  console.log('\n📦 Récupération des buckets Supabase...');
  
  const { data: buckets, error } = await supabase.storage.listBuckets();
  
  if (error) {
    throw new Error(`Erreur listBuckets: ${error.message}`);
  }
  
  const bucketInfos: BucketInfo[] = [];
  
  for (const bucket of buckets) {
    const { data: files, error: listError } = await supabase.storage
      .from(bucket.name)
      .list('', { limit: 10000 });
    
    if (listError) {
      console.warn(`  ⚠️ Impossible de lister ${bucket.name}: ${listError.message}`);
      continue;
    }
    
    let totalSize = 0;
    let fileCount = 0;
    
    // Fonction récursive pour compter les fichiers
    async function countFiles(prefix: string): Promise<void> {
      const { data: items } = await supabase.storage
        .from(bucket.name)
        .list(prefix, { limit: 1000 });
      
      if (!items) return;
      
      for (const item of items) {
        if (item.id) {
          // C'est un fichier
          fileCount++;
          totalSize += item.metadata?.size || 0;
        } else {
          // C'est un dossier
          await countFiles(prefix ? `${prefix}/${item.name}` : item.name);
        }
      }
    }
    
    await countFiles('');
    
    bucketInfos.push({
      name: bucket.name,
      public: bucket.public,
      fileCount,
      totalSize,
    });
    
    console.log(`  📁 ${bucket.name}: ${fileCount} fichiers (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
  }
  
  return bucketInfos;
}

// Téléchargement des fichiers Supabase
async function downloadFromSupabase(
  supabase: any,
  bucketName: string,
  outputDir: string
): Promise<FileInfo[]> {
  console.log(`\n⬇️ Téléchargement de ${bucketName}...`);
  
  const files: FileInfo[] = [];
  const bucketDir = path.join(outputDir, bucketName);
  
  // Créer le répertoire
  fs.mkdirSync(bucketDir, { recursive: true });
  
  // Fonction récursive pour télécharger
  async function downloadFolder(prefix: string): Promise<void> {
    const { data: items, error } = await supabase.storage
      .from(bucketName)
      .list(prefix, { limit: 1000 });
    
    if (error || !items) return;
    
    for (const item of items) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      
      if (item.id) {
        // C'est un fichier
        try {
          const { data, error: downloadError } = await supabase.storage
            .from(bucketName)
            .download(itemPath);
          
          if (downloadError || !data) {
            console.warn(`    ⚠️ Échec: ${itemPath}`);
            continue;
          }
          
          // Sauvegarder le fichier
          const filePath = path.join(bucketDir, itemPath);
          const fileDir = path.dirname(filePath);
          fs.mkdirSync(fileDir, { recursive: true });
          
          const buffer = Buffer.from(await data.arrayBuffer());
          fs.writeFileSync(filePath, buffer);
          
          files.push({
            bucket: bucketName,
            path: itemPath,
            size: buffer.length,
            mimeType: item.metadata?.mimetype || 'application/octet-stream',
          });
          
          process.stdout.write(`\r    Fichiers: ${files.length}`);
          
        } catch (err) {
          console.warn(`    ⚠️ Erreur: ${itemPath}`);
        }
      } else {
        // C'est un dossier
        await downloadFolder(itemPath);
      }
    }
  }
  
  await downloadFolder('');
  console.log(` ✅`);
  
  return files;
}

// Upload vers S3/MinIO
async function uploadToS3(
  s3Client: any,
  config: MigrationConfig,
  bucketName: string,
  files: FileInfo[],
  sourceDir: string
): Promise<void> {
  console.log(`\n⬆️ Upload vers ${config.target}/${config.bucket}/${bucketName}...`);
  
  const { PutObjectCommand, CreateBucketCommand, HeadBucketCommand } = await import('@aws-sdk/client-s3');
  
  // Vérifier/créer le bucket
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch (error: any) {
    if (error.name === 'NotFound') {
      console.log(`  📦 Création du bucket ${config.bucket}...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: config.bucket }));
    } else {
      throw error;
    }
  }
  
  let uploaded = 0;
  
  for (const file of files) {
    const filePath = path.join(sourceDir, file.bucket, file.path);
    const s3Key = `${bucketName}/${file.path}`;
    
    if (!fs.existsSync(filePath)) {
      console.warn(`    ⚠️ Fichier non trouvé: ${filePath}`);
      continue;
    }
    
    const fileContent = fs.readFileSync(filePath);
    
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: file.mimeType,
      }));
      
      uploaded++;
      process.stdout.write(`\r    Uploadés: ${uploaded}/${files.length}`);
      
    } catch (error: any) {
      console.warn(`    ⚠️ Échec upload: ${s3Key} - ${error.message}`);
    }
  }
  
  console.log(` ✅`);
}

// Génération du mapping de migration
function generateMappingFile(
  files: FileInfo[],
  config: MigrationConfig,
  outputDir: string
): void {
  const mapping: Record<string, string> = {};
  
  for (const file of files) {
    // URL Supabase originale
    const supabaseUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path}`;
    
    // Nouvelle URL
    let newUrl: string;
    if (config.target === 'minio') {
      newUrl = `${config.endpoint}/${config.bucket}/${file.bucket}/${file.path}`;
    } else {
      newUrl = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${file.bucket}/${file.path}`;
    }
    
    mapping[supabaseUrl] = newUrl;
  }
  
  const mappingPath = path.join(outputDir, 'url-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  
  console.log(`\n📄 Mapping sauvegardé: ${mappingPath}`);
}

// Point d'entrée
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   OPENPULSE IA - Migration Storage vers S3/MinIO');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const args = parseArgs();
  
  // Configuration
  const config: MigrationConfig = {
    target: args.target || 'minio',
    endpoint: args.endpoint || 'http://localhost:9000',
    accessKey: args.accessKey || process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    secretKey: args.secretKey || process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
    bucket: args.bucket || 'marque-storage',
    region: args.region || 'eu-west-3',
    outputDir: args.outputDir || './storage-migration',
  };
  
  console.log(`📋 Configuration:`);
  console.log(`   Target: ${config.target}`);
  console.log(`   Endpoint: ${config.endpoint || 'AWS S3'}`);
  console.log(`   Bucket: ${config.bucket}`);
  console.log(`   Output: ${config.outputDir}`);
  
  // Créer le répertoire de sortie
  fs.mkdirSync(config.outputDir, { recursive: true });
  
  try {
    // Clients
    const supabase = getSupabaseClient();
    const s3Client = await getS3Client(config);
    
    // Lister les buckets
    const buckets = await listSupabaseBuckets(supabase);
    
    if (buckets.length === 0) {
      console.log('\n⚠️ Aucun bucket trouvé');
      return;
    }
    
    // Statistiques
    const totalFiles = buckets.reduce((sum, b) => sum + b.fileCount, 0);
    const totalSize = buckets.reduce((sum, b) => sum + b.totalSize, 0);
    
    console.log(`\n📊 Total: ${totalFiles} fichiers, ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Migration bucket par bucket
    const allFiles: FileInfo[] = [];
    
    for (const bucket of buckets) {
      if (bucket.fileCount === 0) {
        console.log(`\n⏭️ ${bucket.name}: vide, ignoré`);
        continue;
      }
      
      // Télécharger
      const files = await downloadFromSupabase(supabase, bucket.name, config.outputDir);
      allFiles.push(...files);
      
      // Uploader
      await uploadToS3(s3Client, config, bucket.name, files, config.outputDir);
    }
    
    // Générer le mapping
    generateMappingFile(allFiles, config, config.outputDir);
    
    // Rapport final
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   📊 RAPPORT DE MIGRATION');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Buckets migrés: ${buckets.length}`);
    console.log(`   Fichiers migrés: ${allFiles.length}`);
    console.log(`   Taille totale: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
    console.log('   📄 Fichiers générés:');
    console.log(`      - ${config.outputDir}/url-mapping.json`);
    console.log('');
    console.log('   ⚠️ PROCHAINES ÉTAPES:');
    console.log('      1. Mettre à jour les URLs dans la base de données');
    console.log('      2. Configurer les policies CORS sur le nouveau storage');
    console.log('      3. Tester l\'accès aux fichiers');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

main();
