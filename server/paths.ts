import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const CHRONICLE = path.join(ROOT, 'chronicle')
export const CONFIG = path.join(ROOT, 'config')
export const SERVER_DIR = path.join(ROOT, 'server')
export const WEB_DIR = path.join(ROOT, 'web')
