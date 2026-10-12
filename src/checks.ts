import type {CheckResult,UrlCheck} from './types.js';
import {stat,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
const result=(kind:CheckResult['kind'],name:string,passed:boolean,code:string):CheckResult=>({kind,name,passed,code});
export function checkEnvironment(names:string[],env:NodeJS.ProcessEnv):CheckResult[]{
  return names.map(name=>{const passed=Boolean(env[name]?.trim());return result('env',name,passed,passed?'ENV_OK':'ENV_MISSING');});
}
export async function checkFiles(paths:string[],base:string):Promise<CheckResult[]>{
  return Promise.all(paths.map(async name=>{
    try {
      const path=resolve(base,name);
      if(!(await stat(path)).isFile())return result('file',name,false,'FILE_NOT_REGULAR');
      await access(path,constants.R_OK);return result('file',name,true,'FILE_OK');
    }catch{return result('file',name,false,'FILE_UNREADABLE');}
  }));
}
function safeUrl(source:string):URL {
  const url=new URL(source);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid URL.');
  return url;
}
async function probeUrl(initial:URL,check:UrlCheck):Promise<string>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),check.timeoutMs);
  let current=initial;
  try {
    for(let redirects=0; ; redirects++){
      const response=await fetch(current,{redirect:'manual',signal:controller.signal});
      await response.body?.cancel();
      if([301,302,303,307,308].includes(response.status)){
        if(redirects>=3)return 'URL_REDIRECT_LIMIT';
        const location=response.headers.get('location');
        if(!location)return 'URL_INVALID';
        try {current=safeUrl(new URL(location,current).href);}catch{return 'URL_INVALID';}
        continue;
      }
      return response.status===check.expectedStatus?'URL_OK':'URL_STATUS';
    }
  }catch{return controller.signal.aborted?'URL_TIMEOUT':'URL_REQUEST_FAILED';}
  finally{clearTimeout(timer);}
}
export async function checkUrls(checks:UrlCheck[],env:NodeJS.ProcessEnv,probe:boolean):Promise<CheckResult[]>{
  const results:CheckResult[]=[];
  for(const check of checks){
    let url:URL;
    try {
      const source=check.env === undefined ? check.url : env[check.env];
      if(!source?.trim())throw new Error('Missing URL.');
      url=safeUrl(source);
      if(check.path!==undefined){const next=safeUrl(new URL(check.path,url).href);if(next.origin!==url.origin)throw new Error('Invalid path.');url=next;}
    }catch{results.push(result('url',check.name,false,'URL_INVALID'));continue;}
    const code=probe?await probeUrl(url,check):'URL_VALID';
    results.push(result('url',check.name,code==='URL_OK'||code==='URL_VALID',code));
  }
  return results;
}
