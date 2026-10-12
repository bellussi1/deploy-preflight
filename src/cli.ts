#!/usr/bin/env -S node --
import {loadConfig,ConfigError} from './config.js';
import {loadEnvironment,EnvironmentError} from './environment.js';
import {runChecks} from './runner.js';
import {formatReport} from './report.js';
import {readFile} from 'node:fs/promises';
class ArgumentsError extends Error {}
const args=process.argv.slice(2);
const json=args.includes('--json');
const help=`deploy-preflight check [options]

--config <file>    Configuration (default: preflight.config.json)
--env-file <file>  Explicit environment file; process values take precedence
--probe-urls      Send HTTP GET requests (off by default)
--json            Machine-readable report
--help            Show help
--version         Show version`;
async function main(){
  try {
    const options=new Map<string,string|boolean>();
    let command=false;
    for(let index=0;index<args.length;index++){
      const arg=args[index]!;
      if(arg==='check' && index===0){command=true;continue;}
      if(!['--config','--env-file','--probe-urls','--json','--help','--version'].includes(arg)||options.has(arg))throw new ArgumentsError();
      if(arg==='--config'||arg==='--env-file'){
        const value=args[++index];if(!value||value.startsWith('--'))throw new ArgumentsError();options.set(arg,value);
      }else options.set(arg,true);
    }
    if(options.has('--help')||options.has('--version')){
      if(options.size!==1)throw new ArgumentsError();
      const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version as string;
      console.log(options.has('--help')?help:version);return;
    }
    if(!command)throw new ArgumentsError();
    const {config,baseDir}=await loadConfig(options.get('--config') as string ?? 'preflight.config.json');
    const env=await loadEnvironment(options.get('--env-file') as string|undefined,process.env);
    const report=await runChecks(config,baseDir,env,options.has('--probe-urls'));
    console.log(formatReport(report,json));process.exitCode=report.passed?0:1;
  }catch(error){
    const code=error instanceof ArgumentsError?'ARGS_INVALID':error instanceof ConfigError?'CONFIG_INVALID':error instanceof EnvironmentError?'ENV_FILE_INVALID':'INTERNAL_ERROR';
    if(json)console.log(JSON.stringify({passed:false,error:{code}}));
    else console.error(`Preflight error: ${code}. Use --help for usage.`);
    process.exitCode=2;
  }
}
await main();

