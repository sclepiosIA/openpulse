/**
 * Script de conversion des Edge Functions Supabase → Routes Express
 * 
 * Ce script analyse les Edge Functions Deno dans supabase/functions/
 * et génère des routes Express équivalentes dans server/src/routes/
 */

import * as fs from 'fs';
import * as path from 'path';

interface EdgeFunctionInfo {
  name: string;
  path: string;
  hasAuth: boolean;
  imports: string[];
  exports: string[];
  httpMethods: string[];
  dependencies: string[];
}

interface ConversionResult {
  functionName: string;
  expressCode: string;
  serviceCode: string;
  success: boolean;
  errors: string[];
}

const FUNCTIONS_DIR = 'supabase/functions';
const OUTPUT_DIR = 'server/src/routes/generated';
const SERVICES_DIR = 'server/src/services/generated';

// Mapping des imports Deno → Node.js
const IMPORT_MAPPINGS: Record<string, string> = {
  'https://deno.land/std@0.168.0/http/server.ts': 'express',
  'https://esm.sh/@supabase/supabase-js@2': '@supabase/supabase-js',
  'https://deno.land/x/cors/mod.ts': 'cors',
};

// Dépendances communes
const COMMON_DEPS = ['express', 'cors', '@supabase/supabase-js'];

/**
 * Analyse une Edge Function
 */
function analyzeEdgeFunction(functionPath: string): EdgeFunctionInfo {
  const indexPath = path.join(functionPath, 'index.ts');
  
  if (!fs.existsSync(indexPath)) {
    throw new Error(`No index.ts found in ${functionPath}`);
  }

  const content = fs.readFileSync(indexPath, 'utf-8');
  const name = path.basename(functionPath);

  // Extraire les imports
  const importRegex = /import\s+(?:{[^}]+}|[^;]+)\s+from\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Détecter l'authentification
  const hasAuth = content.includes('Authorization') || 
                  content.includes('auth.getUser') ||
                  content.includes('supabase.auth');

  // Détecter les méthodes HTTP
  const httpMethods: string[] = [];
  if (content.includes('req.method === \'GET\'') || content.includes('method === "GET"')) {
    httpMethods.push('GET');
  }
  if (content.includes('req.method === \'POST\'') || content.includes('method === "POST"')) {
    httpMethods.push('POST');
  }
  if (content.includes('req.method === \'PUT\'') || content.includes('method === "PUT"')) {
    httpMethods.push('PUT');
  }
  if (content.includes('req.method === \'DELETE\'') || content.includes('method === "DELETE"')) {
    httpMethods.push('DELETE');
  }
  if (content.includes('req.method === \'PATCH\'') || content.includes('method === "PATCH"')) {
    httpMethods.push('PATCH');
  }
  
  // Si aucune méthode explicite, considérer POST par défaut
  if (httpMethods.length === 0) {
    httpMethods.push('POST');
  }

  // Détecter les dépendances spécifiques
  const dependencies: string[] = [...COMMON_DEPS];
  if (content.includes('crypto')) dependencies.push('crypto');
  if (content.includes('nodemailer') || content.includes('sendEmail')) dependencies.push('nodemailer');
  if (content.includes('OpenAI') || content.includes('azure')) dependencies.push('openai');

  return {
    name,
    path: functionPath,
    hasAuth,
    imports,
    exports: [],
    httpMethods,
    dependencies,
  };
}

/**
 * Convertit une Edge Function en route Express
 */
function convertToExpress(info: EdgeFunctionInfo): ConversionResult {
  const indexPath = path.join(info.path, 'index.ts');
  let content = fs.readFileSync(indexPath, 'utf-8');
  const errors: string[] = [];

  try {
    // Remplacer les imports Deno
    for (const [denoImport, nodeImport] of Object.entries(IMPORT_MAPPINGS)) {
      content = content.replace(new RegExp(denoImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), nodeImport);
    }

    // Convertir serve() → Express router
    content = content.replace(/import\s*{\s*serve\s*}\s*from\s*['"][^'"]+['"]/g, '');
    content = content.replace(/serve\s*\(\s*async\s*\(\s*req\s*\)\s*=>\s*{/, '');

    // Convertir Deno.env.get → process.env
    content = content.replace(/Deno\.env\.get\(['"]([^'"]+)['"]\)/g, 'process.env.$1');

    // Convertir Response → Express res
    content = content.replace(
      /return\s+new\s+Response\s*\(\s*JSON\.stringify\s*\(\s*([^)]+)\s*\)\s*,\s*{\s*status:\s*(\d+)\s*,\s*headers:\s*([^}]+)}\s*\)/g,
      'return res.status($2).json($1)'
    );
    content = content.replace(
      /return\s+new\s+Response\s*\(\s*JSON\.stringify\s*\(\s*([^)]+)\s*\)\s*,\s*{\s*headers:\s*([^}]+)}\s*\)/g,
      'return res.json($1)'
    );
    content = content.replace(
      /return\s+new\s+Response\s*\(\s*null\s*,\s*{\s*headers:\s*corsHeaders\s*}\s*\)/g,
      'return res.status(204).send()'
    );

    // Convertir req.json() → req.body
    content = content.replace(/await\s+req\.json\(\)/g, 'req.body');
    content = content.replace(/const\s+(\w+)\s*=\s*req\.body/g, 'const $1 = req.body');

    // Générer le code Express
    const routerName = info.name.replace(/-/g, '_');
    const expressCode = generateExpressRoute(info, content);
    const serviceCode = generateService(info, content);

    return {
      functionName: info.name,
      expressCode,
      serviceCode,
      success: true,
      errors,
    };
  } catch (error: any) {
    errors.push(error.message);
    return {
      functionName: info.name,
      expressCode: '',
      serviceCode: '',
      success: false,
      errors,
    };
  }
}

/**
 * Génère le code de route Express
 */
function generateExpressRoute(info: EdgeFunctionInfo, processedContent: string): string {
  const routerName = info.name.replace(/-/g, '_');
  const serviceName = `${routerName}Service`;

  const methods = info.httpMethods.map(method => {
    const methodLower = method.toLowerCase();
    return `
router.${methodLower}('/', ${info.hasAuth ? 'authMiddleware, ' : ''}async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ${serviceName}.handle${method}(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
});`;
  }).join('\n');

  return `/**
 * Route Express générée depuis Edge Function: ${info.name}
 * Généré automatiquement - Ne pas modifier manuellement
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { ${serviceName} } from '../../services/generated/${info.name}.service';

const router = Router();

// OPTIONS pour CORS
router.options('/', (req, res) => {
  res.status(204).send();
});

${methods}

export default router;
`;
}

/**
 * Génère le code de service
 */
function generateService(info: EdgeFunctionInfo, processedContent: string): string {
  const serviceName = info.name.replace(/-/g, '_');

  // Extraire la logique métier (simplifiée)
  const businessLogic = extractBusinessLogic(processedContent);

  const methods = info.httpMethods.map(method => {
    return `
  static async handle${method}(req: Request): Promise<any> {
    const body = req.body;
    const user = (req as any).user;
    
    // TODO: Implémenter la logique métier
    // Logique originale extraite :
    ${businessLogic}
    
    return { success: true };
  }`;
  }).join('\n');

  return `/**
 * Service généré depuis Edge Function: ${info.name}
 * Généré automatiquement - À compléter manuellement
 */
import { Request } from 'express';
import { db } from '../../database';

export class ${serviceName}Service {
${methods}
}
`;
}

/**
 * Extrait la logique métier d'une Edge Function
 */
function extractBusinessLogic(content: string): string {
  // Chercher le bloc try/catch principal
  const tryMatch = content.match(/try\s*{([\s\S]*?)}\s*catch/);
  if (tryMatch) {
    return tryMatch[1]
      .trim()
      .split('\n')
      .map(line => `    // ${line.trim()}`)
      .join('\n');
  }
  return '    // Logique à implémenter';
}

/**
 * Liste toutes les Edge Functions
 */
function listEdgeFunctions(): string[] {
  if (!fs.existsSync(FUNCTIONS_DIR)) {
    console.error(`Directory ${FUNCTIONS_DIR} not found`);
    return [];
  }

  return fs.readdirSync(FUNCTIONS_DIR)
    .filter(name => {
      const fullPath = path.join(FUNCTIONS_DIR, name);
      return fs.statSync(fullPath).isDirectory() && 
             !name.startsWith('_') && // Ignorer les dossiers partagés
             fs.existsSync(path.join(fullPath, 'index.ts'));
    });
}

/**
 * Génère l'index des routes
 */
function generateRoutesIndex(functions: EdgeFunctionInfo[]): string {
  const imports = functions.map(f => 
    `import ${f.name.replace(/-/g, '_')}Router from './${f.name}';`
  ).join('\n');

  const routes = functions.map(f => 
    `  app.use('/api/functions/${f.name}', ${f.name.replace(/-/g, '_')}Router);`
  ).join('\n');

  return `/**
 * Index des routes générées depuis Edge Functions
 * Généré automatiquement - Ne pas modifier manuellement
 */
import { Express } from 'express';

${imports}

export function registerGeneratedRoutes(app: Express): void {
${routes}
}
`;
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('🚀 Conversion des Edge Functions Supabase → Routes Express\n');

  // Créer les répertoires de sortie
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(SERVICES_DIR, { recursive: true });

  // Lister les fonctions
  const functionNames = listEdgeFunctions();
  console.log(`📦 ${functionNames.length} Edge Functions trouvées\n`);

  const results: ConversionResult[] = [];
  const infos: EdgeFunctionInfo[] = [];

  for (const name of functionNames) {
    const fullPath = path.join(FUNCTIONS_DIR, name);
    console.log(`  ⚙️  Analyse: ${name}`);

    try {
      const info = analyzeEdgeFunction(fullPath);
      infos.push(info);

      const result = convertToExpress(info);
      results.push(result);

      if (result.success) {
        // Écrire la route
        const routePath = path.join(OUTPUT_DIR, `${name}.ts`);
        fs.writeFileSync(routePath, result.expressCode);

        // Écrire le service
        const servicePath = path.join(SERVICES_DIR, `${name}.service.ts`);
        fs.writeFileSync(servicePath, result.serviceCode);

        console.log(`  ✅ ${name} converti`);
      } else {
        console.log(`  ❌ ${name} - Erreurs: ${result.errors.join(', ')}`);
      }
    } catch (error: any) {
      console.log(`  ❌ ${name} - ${error.message}`);
      results.push({
        functionName: name,
        expressCode: '',
        serviceCode: '',
        success: false,
        errors: [error.message],
      });
    }
  }

  // Générer l'index
  const indexCode = generateRoutesIndex(infos);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexCode);

  // Résumé
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n📊 Résumé:');
  console.log(`  ✅ Convertis: ${successful}`);
  console.log(`  ❌ Échecs: ${failed}`);
  console.log(`\n📁 Routes générées: ${OUTPUT_DIR}`);
  console.log(`📁 Services générés: ${SERVICES_DIR}`);

  // Générer le rapport
  const report = {
    timestamp: new Date().toISOString(),
    total: functionNames.length,
    successful,
    failed,
    results: results.map(r => ({
      name: r.functionName,
      success: r.success,
      errors: r.errors,
    })),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_conversion-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n✨ Conversion terminée!');
  console.log('\n⚠️  IMPORTANT:');
  console.log('  - Les services générés nécessitent une révision manuelle');
  console.log('  - Vérifiez la logique métier et les requêtes base de données');
  console.log('  - Testez chaque route avant mise en production');
}

main().catch(console.error);
