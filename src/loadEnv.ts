import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendDir, '..');

/** Repo root .env first, then backend/.env (backend wins on duplicate keys) */
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(backendDir, '.env') });
