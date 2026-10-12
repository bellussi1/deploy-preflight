import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Config, UrlCheck } from './types.js';

export class ConfigError extends Error { constructor() { super('Invalid configuration.'); } }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && !/[\x00-\x1f\x7f]/.test(value);
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new ConfigError();
}
function strings(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(text)) throw new ConfigError();
  return value;
}
function urlCheck(value: unknown): UrlCheck {
  if (!object(value)) throw new ConfigError();
  keys(value,['name','url','env','path','expectedStatus','timeoutMs']);
  if (!text(value.name) || (Object.hasOwn(value,'url') === Object.hasOwn(value,'env'))) throw new ConfigError();
  if (value.url !== undefined && !text(value.url) || value.env !== undefined && !text(value.env)) throw new ConfigError();
  if (value.path !== undefined && !text(value.path)) throw new ConfigError();
  const status = value.expectedStatus ?? 200;
  const timeout = value.timeoutMs ?? 5000;
  if (!Number.isInteger(status) || Number(status) < 100 || Number(status) > 599 || !Number.isInteger(timeout) || Number(timeout) < 100 || Number(timeout) > 30000) throw new ConfigError();
  return {...value,expectedStatus:status,timeoutMs:timeout} as UrlCheck;
}
export async function loadConfig(path: string): Promise<{config:Config;baseDir:string}> {
  try {
    const value: unknown = JSON.parse(await readFile(path,'utf8'));
    if (!object(value)) throw new ConfigError();
    keys(value,['requiredEnv','requiredFiles','urls']);
    if (value.urls !== undefined && !Array.isArray(value.urls)) throw new ConfigError();
    return {config:{requiredEnv:strings(value.requiredEnv),requiredFiles:strings(value.requiredFiles),urls:((value.urls ?? []) as unknown[]).map(urlCheck)},baseDir:dirname(resolve(path))};
  } catch { throw new ConfigError(); }
}
