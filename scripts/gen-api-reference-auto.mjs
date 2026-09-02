import fs from 'fs';
import path from 'path';

const funcDir = 'supabase/functions';
const config = fs.readFileSync('supabase/config.toml', 'utf8');

// Parse config.toml functions
const jwtMap = {};
const re = /\[functions\.([^\]]+)\]\s*\nverify_jwt\s*=\s*(true|false)/g;
let m;
while ((m = re.exec(config)) !== null) jwtMap[m[1]] = m[2] === 'true';

const fns = fs.readdirSync(funcDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_'))
  .map(d => d.name)
  .sort();

// Categorize by name prefix
const cat = (n) => {
  if (/^(sync-email|send-email|process-email|email-|generate-thread|reformulate|correct-spelling|suggest-email|translate-email|track-email|imap)/.test(n)) return 'Email';
  if (/^(rh-|parse-bulletin|export-paie|sync-rh|hr-|note-frais|ocr-note)/.test(n)) return 'RH / People';
  if (/^(tresorerie|qonto|invoice|facture|billing|payment|stripe|sync-stripe)/.test(n)) return 'Trésorerie & Facturation';
  if (/^(contrat|docuseal|signature)/.test(n)) return 'Contrats (DocuSeal)';
  if (/^(pulse|chat-|notif-internal)/.test(n)) return 'Pulse (Communication)';
  if (/^(rd-|sprint-|agile-)/.test(n)) return 'R&D';
  if (/^(support|ticket|create-support)/.test(n)) return 'Support';
  if (/^(formation|emargement|enquete|launchpad)/.test(n)) return 'Formations';
  if (/^(booking|public-booking|calendar)/.test(n)) return 'Booking & Calendrier';
  if (/^(kb-|knowledge|docs-|ged-|document)/.test(n)) return 'Knowledge Base & GED';
  if (/^(notif|push-|web-push|fcm)/.test(n)) return 'Notifications';
  if (/^(jarvis|azure|ai-|analyze-|generate-ai|chat-completions|llm-)/.test(n)) return 'IA / Azure GPT-5';
  if (/^(admin-|rbac|2fa|auth|user-role|generate-2fa)/.test(n)) return 'Auth & Admin';
  if (/^(rgpd|gdpr|audit-|compliance)/.test(n)) return 'Conformité & RGPD';
  if (/^(monitor|metrics|health|web-vitals|log-|cron-)/.test(n)) return 'Monitoring & CRON';
  if (/^(recrutement|recruit|interview|career|job-)/.test(n)) return 'Recrutement';
  if (/^(social-|facebook|instagram|linkedin|tiktok|publish-social|oauth-social)/.test(n)) return 'Social Dashboard';
  if (/^(portal-|client-portal)/.test(n)) return 'Portail Client';
  return 'Utilitaires';
};

const groups = {};
for (const f of fns) {
  const g = cat(f);
  (groups[g] ||= []).push(f);
}

let out = `# API Reference auto-généré — Edge Functions OpenPulse\n\n`;
out += `> **Généré automatiquement** depuis \`supabase/functions/\` et \`supabase/config.toml\`.\n`;
out += `> **Vérifié le** : ${new Date().toISOString().slice(0,10)} | **Total** : ${fns.length} Edge Functions\n\n`;
out += `Ce fichier liste **exhaustivement** toutes les fonctions déployées. Pour le détail des payloads et exemples \`curl\`, voir [\`API_REFERENCE.md\`](./API_REFERENCE.md) (documentation manuelle, ~162 fonctions principales).\n\n`;
out += `## Légende \`verify_jwt\`\n\n`;
out += `- 🔒 \`true\` — JWT requis (défaut)\n- 🌐 \`false\` — endpoint public\n- ⚪ non déclaré dans \`config.toml\` (défaut Supabase = \`true\`)\n\n---\n\n`;

for (const g of Object.keys(groups).sort()) {
  out += `## ${g} (${groups[g].length})\n\n`;
  out += `| Fonction | \`verify_jwt\` |\n|---|---|\n`;
  for (const f of groups[g]) {
    const j = jwtMap[f];
    const sym = j === true ? '🔒 true' : j === false ? '🌐 false' : '⚪ (défaut)';
    out += `| \`${f}\` | ${sym} |\n`;
  }
  out += `\n`;
}

out += `---\n\n## Couverture par config.toml\n\n`;
const declared = fns.filter(f => f in jwtMap).length;
out += `- Déclarées dans \`config.toml\` : **${declared} / ${fns.length}**\n`;
out += `- Non déclarées (défaut \`verify_jwt=true\`) : **${fns.length - declared}**\n`;
out += `- Publiques (\`verify_jwt=false\`) : **${Object.values(jwtMap).filter(v=>v===false).length}**\n`;

fs.writeFileSync('docs/API_REFERENCE_AUTO.md', out);
console.log('Wrote docs/API_REFERENCE_AUTO.md', fns.length, 'fns,', Object.keys(groups).length, 'groups');
