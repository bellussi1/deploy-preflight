import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
export class EnvironmentError extends Error {constructor(){super('Cannot load environment file.');}}
export function environmentValue(env:NodeJS.ProcessEnv,name:string):string|undefined{
  const key=process.platform==='win32'?Object.keys(env).find(key=>key.toUpperCase()===name.toUpperCase()):name;
  return key!==undefined && Object.hasOwn(env,key) ? env[key] : undefined;
}
export async function loadEnvironment(file:string|undefined,env:NodeJS.ProcessEnv):Promise<NodeJS.ProcessEnv>{
  try {
    const merged:NodeJS.ProcessEnv=Object.create(null);
    const fromFile=file===undefined?{}:parseEnv(await readFile(file,'utf8'));
    for(const source of [fromFile,env])for(const [key,value] of Object.entries(source))merged[process.platform==='win32'?key.toUpperCase():key]=value;
    return merged;
  }
  catch {throw new EnvironmentError();}
}
