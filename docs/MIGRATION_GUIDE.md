# Guide de Migration - Supabase vers Self-Hosted

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Analyse des Dépendances](#analyse-des-dépendances)
3. [Pré-Migration Checklist](#pré-migration-checklist)
4. [Migration Base de Données](#migration-base-de-données)
5. [Migration Authentification](#migration-authentification)
6. [Migration Edge Functions](#migration-edge-functions)
7. [Migration Storage](#migration-storage)
8. [Migration RLS → Middleware](#migration-rls--middleware)
9. [Tests et Validation](#tests-et-validation)
10. [Rollback Plan](#rollback-plan)

---

## Vue d'Ensemble

### Architecture Actuelle (Supabase)

```
┌─────────────────────────────────────────────────────────────┐
│                      la plateforme initiale Platform                        │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  Frontend React │  │  Edge Functions │                   │
│  │    (Vite)       │  │     (Deno)      │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                             │
│           └──────────┬─────────┘                             │
│                      │                                       │
│  ┌───────────────────▼───────────────────┐                  │
│  │              Supabase                  │                  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐  │                  │
│  │  │   Auth  │ │ Postgres│ │ Storage │  │                  │
│  │  │   JWT   │ │   RLS   │ │ Buckets │  │                  │
│  │  └─────────┘ └─────────┘ └─────────┘  │                  │
│  └───────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Cible (Self-Hosted)

```
┌─────────────────────────────────────────────────────────────┐
│                     Serveur Production                       │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  Frontend React │  │   API Express   │                   │
│  │   (Nginx/CDN)   │  │    (Node.js)    │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                             │
│           └──────────┬─────────┘                             │
│                      │                                       │
│  ┌───────────────────▼───────────────────┐                  │
│  │         PostgreSQL / MySQL             │                  │
│  │  ┌─────────────────────────────────┐  │                  │
│  │  │  Middleware Auth + RLS Logic    │  │                  │
│  │  └─────────────────────────────────┘  │                  │
│  └───────────────────────────────────────┘                  │
│                                                              │
│  ┌───────────────────────────────────────┐                  │
│  │         S3 / MinIO Storage            │                  │
│  └───────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Estimation de l'Effort

| Composant | Complexité | Effort Estimé |
|-----------|------------|---------------|
| Export données PostgreSQL | 🟢 Faible | 1 jour |
| Migration schéma vers MySQL | 🔴 Élevée | 5 jours |
| Conversion Edge Functions → Express | 🔴 Élevée | 10-15 jours |
| Migration authentification | 🟡 Moyenne | 3 jours |
| Migration RLS → Middleware | 🔴 Élevée | 5 jours |
| Migration Storage | 🟡 Moyenne | 2 jours |
| Tests et validation | 🟡 Moyenne | 3 jours |
| **Total (PostgreSQL)** | - | **15-20 jours** |
| **Total (MySQL)** | - | **30-35 jours** |

---

## Analyse des Dépendances

### Dépendances Supabase Identifiées

#### 1. Client Supabase (Frontend)

```typescript
// Fichier: src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

// Utilisé dans 260+ hooks:
// - supabase.from('table').select()
// - supabase.from('table').insert()
// - supabase.from('table').update()
// - supabase.from('table').delete()
// - supabase.rpc('function_name')
// - supabase.auth.signIn/signUp/signOut
// - supabase.storage.from('bucket')
```

#### 2. Types Générés

```typescript
// Fichier: src/integrations/supabase/types.ts
// 17785+ lignes de types générés automatiquement (436+ tables)
export type Database = {
  public: {
    Tables: { ... },
    Views: { ... },
    Functions: { ... },
    Enums: { ... }
  }
}
```

#### 3. Edge Functions (122 fonctions)

| Catégorie | Nombre | Complexité Migration |
|-----------|--------|---------------------|
| Email (sync, send, AI) | 18 | 🔴 Élevée |
| RH (salaires, parsing) | 10 | 🟡 Moyenne |
| Trésorerie/Facturation | 13 | 🟡 Moyenne |
| R&D | 5 | 🟢 Faible |
| Support | 4 | 🟡 Moyenne |
| Auth/Security | 8 | 🔴 Élevée |
| AI/GPT-5 | 16 | 🟡 Moyenne |
| Pulse | 6 | 🟡 Moyenne |
| Calendrier/Booking | 6 | 🟢 Faible |
| Transcription/Visio | 4 | 🔴 Élevée |
| OAuth | 5 | 🟡 Moyenne |
| CRON | 8 | 🟢 Faible |
| Autres | 19 | 🟢 Faible |

#### 4. Fonctions SQL avec RLS

```sql
-- 25+ fonctions SECURITY DEFINER
-- Exemples:
has_role(user_id, role)
is_admin()
can_manage_rh_data()
has_admin_role_strict()
```

---

## Pré-Migration Checklist

### Préparation Serveur

- [ ] Provisionner serveur production (VPS OVH, AWS EC2, etc.)
- [ ] Installer Docker et Docker Compose
- [ ] Configurer pare-feu (ports 80, 443, 22)
- [ ] Configurer DNS pour le nouveau domaine
- [ ] Préparer certificats SSL

### Préparation Données

- [ ] Auditer les tables Supabase (79 tables)
- [ ] Identifier les données sensibles à chiffrer
- [ ] Estimer le volume de données
- [ ] Planifier la fenêtre de migration

### Préparation Code

- [ ] Créer branche `feature/self-hosted`
- [ ] Implémenter couche d'abstraction base de données
- [ ] Implémenter couche d'abstraction authentification
- [ ] Convertir Edge Functions en routes Express

### Communication

- [ ] Informer les utilisateurs de la maintenance
- [ ] Préparer page de maintenance
- [ ] Définir plan de communication post-migration

---

## Migration Base de Données

### Export Supabase PostgreSQL

```bash
# 1. Exporter le schéma
pg_dump -h db.YOUR_PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  -f schema_export.sql

# 2. Exporter les données
pg_dump -h db.YOUR_PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  --data-only \
  -f data_export.sql

# 3. Exporter les fonctions et triggers
pg_dump -h db.YOUR_PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  -t 'public.*' \
  --section=pre-data \
  -f functions_export.sql
```

### Script d'Export Automatisé

```typescript
// scripts/migration/export-supabase-data.ts
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const TABLES = [
  'etablissements',
  'contacts',
  'taches',
  'profiles',
  'email_threads',
  'email_messages',
  // ... toutes les 79 tables
];

async function exportTable(supabase, tableName: string) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*');
  
  if (error) throw error;
  
  fs.writeFileSync(
    `exports/${tableName}.json`,
    JSON.stringify(data, null, 2)
  );
  
  console.log(`Exported ${tableName}: ${data.length} rows`);
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  fs.mkdirSync('exports', { recursive: true });
  
  for (const table of TABLES) {
    await exportTable(supabase, table);
  }
}

main();
```

### Import PostgreSQL (Self-Hosted)

```bash
# 1. Créer la base de données
psql -U postgres -c "CREATE DATABASE marque_db;"

# 2. Importer le schéma
psql -U postgres -d marque_db -f schema_export.sql

# 3. Importer les données
psql -U postgres -d marque_db -f data_export.sql

# 4. Importer les fonctions
psql -U postgres -d marque_db -f functions_export.sql
```

### Conversion PostgreSQL → MySQL

Si vous choisissez MySQL au lieu de PostgreSQL, utilisez le script de conversion :

```sql
-- scripts/migration/schema-postgresql-to-mysql.sql

-- Conversion des types
-- uuid → CHAR(36)
-- timestamptz → DATETIME
-- jsonb → JSON
-- text[] → JSON (tableau)
-- boolean → TINYINT(1)

-- Exemple: Table etablissements
CREATE TABLE etablissements (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  statut ENUM('Prospect', 'Contactuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live', 'Production', 'Bloqué') DEFAULT 'Prospect',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- ... autres colonnes
  INDEX idx_statut (statut),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Migration Authentification

### Supabase Auth → JWT Custom

#### 1. Export des utilisateurs

```typescript
// scripts/migration/export-users.ts
import { createClient } from '@supabase/supabase-js';

async function exportUsers() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  // Note: auth.users n'est pas accessible via API client
  // Utiliser l'API Admin Supabase
  const response = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/admin/users`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_KEY!
      }
    }
  );
  
  const users = await response.json();
  
  // Sauvegarder (ATTENTION: données sensibles)
  fs.writeFileSync('exports/users.json', JSON.stringify(users, null, 2));
}
```

#### 2. Nouveau système d'authentification

```typescript
// server/src/services/auth.service.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly JWT_EXPIRES = '7d';
  
  async signIn(email: string, password: string) {
    const user = await db.query(
      'SELECT * FROM profiles WHERE email = $1',
      [email]
    );
    
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      throw new Error('Invalid credentials');
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES }
    );
    
    return { user, token };
  }
  
  async signUp(email: string, password: string, metadata: any) {
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await db.query(
      `INSERT INTO profiles (email, password_hash, prenom, nom)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [email, hashedPassword, metadata.prenom, metadata.nom]
    );
    
    return user;
  }
  
  verifyToken(token: string) {
    return jwt.verify(token, this.JWT_SECRET);
  }
}
```

#### 3. Middleware d'authentification

```typescript
// server/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

---

## Migration Edge Functions

### Structure de Conversion

```
supabase/functions/              →    server/src/
├── sync-emails/                 →    ├── routes/email/sync.route.ts
│   └── index.ts                      ├── services/email/sync.service.ts
├── send-email-reply/            →    └── services/email/send.service.ts
├── process-email-with-ai/       →    routes/ai/email-classification.route.ts
├── parse-bulletin-salaire/      →    routes/rh/bulletin.route.ts
└── ...                               └── ...
```

### Exemple de Conversion

#### Edge Function Originale (Deno)

```typescript
// supabase/functions/process-email-with-ai/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '<toutes origines — a proscrire>' };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const { threadId } = await req.json();
  
  // Logique Azure OpenAI
  const response = await fetch(Deno.env.get('AZURE_OPENAI_ENDPOINT')!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': Deno.env.get('AZURE_OPENAI_API_KEY')!
    },
    body: JSON.stringify({
      messages: [{ role: 'system', content: '...' }],
      max_completion_tokens: 3000
    })
  });
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

#### Route Express Convertie

```typescript
// server/src/routes/ai/email-classification.route.ts
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { AzureOpenAIService } from '../../services/azure-openai.service';

const router = Router();
const aiService = new AzureOpenAIService();

router.post('/process-email', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { threadId } = req.body;
    
    const result = await aiService.classifyEmail(threadId);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Script de Conversion Automatique

```typescript
// scripts/migration/convert-edge-functions.ts
import * as fs from 'fs';
import * as path from 'path';

const FUNCTIONS_DIR = 'supabase/functions';
const OUTPUT_DIR = 'server/src/routes';

function convertFunction(functionPath: string) {
  const content = fs.readFileSync(
    path.join(functionPath, 'index.ts'),
    'utf-8'
  );
  
  // Remplacer les imports Deno
  let converted = content
    .replace(/import.*from "https:\/\/deno\.land.*"/g, '')
    .replace(/Deno\.env\.get\('(\w+)'\)/g, 'process.env.$1')
    .replace(/serve\(async \(req\) => \{/, 'export async function handler(req: Request, res: Response) {')
    .replace(/return new Response\(([^,]+),\s*\{/g, 'return res.json($1); // {');
  
  return converted;
}

// Exécution
const functions = fs.readdirSync(FUNCTIONS_DIR);
for (const fn of functions) {
  if (fn.startsWith('_')) continue;
  
  const converted = convertFunction(path.join(FUNCTIONS_DIR, fn));
  
  fs.mkdirSync(path.join(OUTPUT_DIR, fn), { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, fn, 'route.ts'),
    converted
  );
}
```

---

## Migration Storage

### Export depuis Supabase Storage

```typescript
// scripts/migration/migrate-storage.ts
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';

const BUCKETS = ['rh-documents', 'entity-logos', 'email-attachments', 'rd-attachments'];

async function migrateStorage() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!
    }
  });
  
  for (const bucket of BUCKETS) {
    console.log(`Migrating bucket: ${bucket}`);
    
    const { data: files } = await supabase.storage
      .from(bucket)
      .list('', { limit: 1000 });
    
    for (const file of files || []) {
      // Download from Supabase
      const { data: fileData } = await supabase.storage
        .from(bucket)
        .download(file.name);
      
      // Upload to S3
      await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `${bucket}/${file.name}`,
        Body: Buffer.from(await fileData!.arrayBuffer()),
        ContentType: file.metadata?.mimetype
      }));
      
      console.log(`  Migrated: ${file.name}`);
    }
  }
}

migrateStorage();
```

### Service Storage S3

```typescript
// server/src/services/storage.service.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class StorageService {
  private s3: S3Client;
  
  constructor() {
    this.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION!,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!
      }
    });
  }
  
  async upload(bucket: string, path: string, file: Buffer, contentType: string) {
    await this.s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: `${bucket}/${path}`,
      Body: file,
      ContentType: contentType
    }));
    
    return `${bucket}/${path}`;
  }
  
  async getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: `${bucket}/${path}`
    });
    
    return getSignedUrl(this.s3, command, { expiresIn });
  }
  
  async delete(bucket: string, path: string) {
    await this.s3.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: `${bucket}/${path}`
    }));
  }
}
```

---

## Migration RLS → Middleware

### Supabase RLS (Exemple)

```sql
-- Politique RLS actuelle
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (is_admin());
```

### Middleware Express Équivalent

```typescript
// server/src/middleware/rls.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { db } from '../database';

export function rlsMiddleware(tableName: string, operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Vérifier les permissions selon la table
    switch (tableName) {
      case 'profiles':
        await checkProfilesAccess(req, res, next, operation);
        break;
      case 'etablissements':
        await checkEtablissementsAccess(req, res, next, operation);
        break;
      case 'rh_salaires_mensuels':
        await checkRHAccess(req, res, next, operation);
        break;
      default:
        // Par défaut, autoriser les utilisateurs authentifiés
        next();
    }
  };
}

async function checkProfilesAccess(req: Request, res: Response, next: NextFunction, operation: string) {
  const userId = req.user?.userId;
  const targetId = req.params.id || req.body.user_id;
  
  // L'utilisateur peut voir son propre profil
  if (targetId === userId) {
    return next();
  }
  
  // Les admins peuvent tout voir
  const isAdmin = await db.query(
    'SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2',
    [userId, 'admin']
  );
  
  if (isAdmin.rows.length > 0) {
    return next();
  }
  
  return res.status(403).json({ error: 'Access denied' });
}

async function checkRHAccess(req: Request, res: Response, next: NextFunction, operation: string) {
  const userId = req.user?.userId;
  
  // Seuls les admins et RH peuvent accéder
  const hasAccess = await db.query(
    'SELECT 1 FROM user_roles WHERE user_id = $1 AND role IN ($2, $3)',
    [userId, 'admin', 'rh']
  );
  
  if (hasAccess.rows.length === 0) {
    return res.status(403).json({ error: 'Access denied: Admin or RH role required' });
  }
  
  next();
}
```

---

## Tests et Validation

### Checklist de Validation

#### Base de Données

- [ ] Toutes les tables migrées (79 tables)
- [ ] Contraintes et index recréés
- [ ] Données intègres (checksums)
- [ ] Performances acceptables (< 100ms pour requêtes courantes)

#### Authentification

- [ ] Login/Logout fonctionnels
- [ ] Tokens JWT valides
- [ ] 2FA fonctionnel
- [ ] Refresh tokens opérationnels

#### API

- [ ] Tous les endpoints répondent
- [ ] Codes HTTP corrects
- [ ] Temps de réponse < 500ms
- [ ] Gestion d'erreurs appropriée

#### Storage

- [ ] Tous les fichiers migrés
- [ ] URLs signées fonctionnelles
- [ ] Upload/Download opérationnels

### Script de Validation

```typescript
// scripts/migration/verify-migration.ts
import { db } from '../server/src/database';

async function verifyMigration() {
  const checks = [];
  
  // 1. Vérifier le nombre de lignes par table
  const tables = ['etablissements', 'contacts', 'taches', 'profiles'];
  
  for (const table of tables) {
    const result = await db.query(`SELECT COUNT(*) FROM ${table}`);
    checks.push({
      table,
      count: result.rows[0].count,
      status: result.rows[0].count > 0 ? '✅' : '❌'
    });
  }
  
  // 2. Vérifier les relations
  const orphans = await db.query(`
    SELECT COUNT(*) FROM taches t
    LEFT JOIN etablissements e ON t.etablissement_id = e.id
    WHERE e.id IS NULL
  `);
  
  checks.push({
    check: 'Orphan tasks',
    count: orphans.rows[0].count,
    status: orphans.rows[0].count === 0 ? '✅' : '⚠️'
  });
  
  // 3. Afficher résultats
  console.table(checks);
  
  const allPassed = checks.every(c => c.status === '✅');
  console.log(allPassed ? '✅ Migration verified!' : '⚠️ Issues detected');
}

verifyMigration();
```

---

## Rollback Plan

### Procédure de Rollback

```bash
#!/bin/bash
# scripts/rollback.sh

echo "🚨 Starting rollback to Supabase..."

# 1. Arrêter les services
docker-compose -f docker/docker-compose.prod.yml down

# 2. Restaurer DNS vers Supabase/la plateforme initiale
echo "Manual step: Update DNS to point back to la plateforme initiale"

# 3. Restaurer les données (si modifications)
pg_dump -h localhost -U marque marque_db > backup_before_rollback.sql

# 4. Notifier l'équipe
echo "Rollback complete. Verify at https://gestion-marque-ia.apercu.example.org"
```

### Points de Non-Retour

| Étape | Réversibilité | Action Requise |
|-------|---------------|----------------|
| Export données | ✅ Totale | Aucune |
| Changement DNS | ✅ Totale | Modifier DNS |
| Nouvelles données | 🟡 Partielle | Sync bidirectionnelle |
| Auth migré | 🟡 Partielle | Reset mots de passe |
| 1 mois post-migration | ❌ Difficile | Effort significatif |

---

## Planning de Migration

### Phase 1 : Préparation (Semaine 1-2)

- [ ] Configurer serveur production
- [ ] Implémenter couche d'abstraction
- [ ] Convertir Edge Functions critiques (email, auth)
- [ ] Tests en environnement staging

### Phase 2 : Migration (Semaine 3)

- [ ] Annonce maintenance aux utilisateurs
- [ ] Export données Supabase
- [ ] Import dans nouvelle base
- [ ] Migration storage
- [ ] Déploiement API

### Phase 3 : Validation (Semaine 4)

- [ ] Tests fonctionnels complets
- [ ] Tests de charge
- [ ] Correction des bugs
- [ ] Documentation mise à jour

### Phase 4 : Go-Live (Semaine 5)

- [ ] Changement DNS
- [ ] Monitoring actif 24h
- [ ] Support utilisateurs
- [ ] Célébration 🎉
