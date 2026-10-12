import type {Config,RunReport} from './types.js';
import {checkEnvironment,checkFiles,checkUrls} from './checks.js';
export async function runChecks(config:Config,base:string,env:NodeJS.ProcessEnv,probe:boolean):Promise<RunReport>{
  const results=[...checkEnvironment(config.requiredEnv,env),...await checkFiles(config.requiredFiles,base),...await checkUrls(config.urls,env,probe)];
  return {passed:results.every(result=>result.passed),results};
}
