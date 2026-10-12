import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
export class EnvironmentError extends Error {constructor(){super('Cannot load environment file.');}}
export async function loadEnvironment(file:string|undefined,env:NodeJS.ProcessEnv):Promise<NodeJS.ProcessEnv>{
  try {return {...(file === undefined ? {} : parseEnv(await readFile(file,'utf8'))),...env};}
  catch {throw new EnvironmentError();}
}
