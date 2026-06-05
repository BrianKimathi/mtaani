/**
 * Reads ../service.json and writes FIREBASE_SA_* lines into backend/.env
 * Run: npm run env:sync-sa
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendDir, '..');
const servicePath = path.resolve(repoRoot, 'service.json');
const envPath = path.resolve(backendDir, '.env');

if (!existsSync(servicePath)) {
  console.error('Missing service.json at repo root:', servicePath);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(servicePath, 'utf8'));

const saLines = [
  '',
  '# Firebase service account (from service.json) — used on Vercel as separate env vars',
  `FIREBASE_SA_TYPE=${sa.type}`,
  `FIREBASE_SA_PROJECT_ID=${sa.project_id}`,
  `FIREBASE_SA_PRIVATE_KEY_ID=${sa.private_key_id}`,
  `FIREBASE_SA_PRIVATE_KEY="${sa.private_key.replace(/\n/g, '\\n')}"`,
  `FIREBASE_SA_CLIENT_EMAIL=${sa.client_email}`,
  `FIREBASE_SA_CLIENT_ID=${sa.client_id}`,
  `FIREBASE_SA_AUTH_URI=${sa.auth_uri}`,
  `FIREBASE_SA_TOKEN_URI=${sa.token_uri}`,
  `FIREBASE_SA_AUTH_PROVIDER_X509_CERT_URL=${sa.auth_provider_x509_cert_url}`,
  `FIREBASE_SA_CLIENT_X509_CERT_URL=${sa.client_x509_cert_url}`,
  `FIREBASE_SA_UNIVERSE_DOMAIN=${sa.universe_domain ?? 'googleapis.com'}`,
].join('\n');

let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

// Remove old SA block and path-based credential
env = env
  .replace(/# Firebase service account[\s\S]*?(?=\n# |\n[A-Z_]+=|\n*$)/m, '')
  .replace(/^FIREBASE_SERVICE_ACCOUNT_PATH=.*\n?/m, '')
  .replace(/^FIREBASE_SA_[A-Z0-9_]+=.*\n?/gm, '')
  .trimEnd();

if (!env.endsWith('\n')) env += '\n';
env += saLines + '\n';

writeFileSync(envPath, env);
console.log('Updated', envPath, 'with FIREBASE_SA_* from service.json');
console.log('Copy the same FIREBASE_SA_* keys into Vercel Environment Variables.');
