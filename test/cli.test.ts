import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const cli=resolve('dist/cli.js');
const run=(args:string[],cwd?:string,env:NodeJS.ProcessEnv=process.env)=>spawnSync(process.execPath,['--',cli,...args],{cwd,env,encoding:'utf8'});
test('help and version work without configuration',()=>{
  assert.match(execFileSync(process.execPath,[cli,'--help'],{encoding:'utf8'}),/--probe-urls/);
  assert.match(execFileSync(process.execPath,[cli,'--version'],{encoding:'utf8'}),/0\.1\.0/);
});
test('invalid arguments produce exit 2 and valid JSON without raw input',()=>{
  for(const args of [[],['oops'],['check','--unknown'],['check','--config'],['check','--json','--json'],['check','--config','a','--config','b']]){
    const result=run([...args,...(args.includes('--json')?[]:['--json'])]);
    assert.equal(result.status,2);assert.equal(JSON.parse(result.stdout).error.code,'ARGS_INVALID');assert.equal(result.stderr,'');
  }
});
test('real CLI exits 0/1/2, keeps secrets out of reports and resolves paths correctly',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'preflight-'));await mkdir(join(dir,'config'));
  try{
    await writeFile(join(dir,'config','artifact'),'ok');
    const config=join(dir,'config','preflight.json');
    await writeFile(config,JSON.stringify({requiredEnv:['PREFLIGHT_TEST_REQUIRED'],requiredFiles:['artifact'],urls:[{name:'API',env:'API'}]}));
    await writeFile(join(dir,'explicit.env'),'PREFLIGHT_TEST_REQUIRED=file\nAPI=https://example.com/?key=SECRET_SENTINEL');
    const env={...process.env,PREFLIGHT_TEST_REQUIRED:'',API:'https://example.com/?key=SECRET_SENTINEL'};
    const failed=run(['check','--config',config,'--env-file','explicit.env','--json'],dir,env);
    assert.equal(failed.status,1);assert.equal(JSON.parse(failed.stdout).passed,false);
    const passed=run(['check','--config',config,'--json'],dir,{...env,PREFLIGHT_TEST_REQUIRED:'SECRET_SENTINEL'});
    assert.equal(passed.status,0);assert.equal(JSON.parse(passed.stdout).passed,true);
    for(const output of [failed,passed])assert.ok(!(output.stdout+output.stderr).includes('SECRET_SENTINEL'));
    const text=run(['check','--config',config],dir,{...env,PREFLIGHT_TEST_REQUIRED:'yes'});
    assert.match(text.stdout,/PASS/);assert.equal(text.status,0);
    await writeFile(config,'{"SECRET_SENTINEL":');
    const invalid=run(['check','--config',config,'--json'],dir,env);
    assert.equal(invalid.status,2);assert.equal(JSON.parse(invalid.stdout).error.code,'CONFIG_INVALID');assert.ok(!invalid.stdout.includes('SECRET_SENTINEL'));
    const missing=run(['check','--config','missing','--json'],dir,env);assert.equal(missing.status,2);
    const envError=run(['check','--env-file','missing','--json'],dir,env);assert.equal(envError.status,2);
  }finally{await rm(dir,{recursive:true,force:true});}
});

