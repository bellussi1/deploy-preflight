export type UrlCheck = { name: string; url?: string; env?: string; path?: string; expectedStatus: number; timeoutMs: number };
export type Config = { requiredEnv: string[]; requiredFiles: string[]; urls: UrlCheck[] };
export type CheckResult = { kind: 'env' | 'file' | 'url'; name: string; passed: boolean; code: string };
export type RunReport = { passed: boolean; results: CheckResult[] };
