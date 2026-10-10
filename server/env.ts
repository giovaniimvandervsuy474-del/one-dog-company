import path from 'node:path'
import { fileURLToPath } from 'node:url'
try { process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')) } catch { /* no .env file */ }
