import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
function npmRun(args:string[],cwd:string){
  const result=spawnSync(process.execPath,[process.env.npm_execpath!,...args],{cwd,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);return result.stdout;
}
test('tarball contains only runtime assets and installed bin supports env-file and JSON exits',async()=>{
  const root=resolve('.');const dir=await mkdtemp(join(tmpdir(),'preflight-package-'));
  try{
    const packed=JSON.parse(npmRun(['pack','--json','--pack-destination',dir],root))[0];
    assert.ok(packed.files.some((file:{path:string})=>file.path==='dist/cli.js'));
    assert.ok(!packed.files.some((file:{path:string})=>file.path.startsWith('test/')||file.path.startsWith('src/')||file.path.includes('.env')));
    await writeFile(join(dir,'package.json'),'{}');
    npmRun(['install','--ignore-scripts','--no-audit','--no-fund',join(dir,packed.filename)],dir);
    const bin=join(dir,'node_modules','.bin',process.platform==='win32'?'deploy-preflight.cmd':'deploy-preflight');
    const run=(args:string[])=>process.platform==='win32'
      ? spawnSync(process.env.ComSpec ?? 'cmd.exe',['/d','/s','/c',`""${bin}" ${args.join(' ')}"`],{cwd:dir,encoding:'utf8',windowsVerbatimArguments:true})
      : spawnSync(bin,args,{cwd:dir,encoding:'utf8'});
    const help=run(['--help']);assert.equal(help.status,0,help.stderr);
    await writeFile(join(dir,'preflight.config.json'),'{"requiredEnv":["PREFLIGHT_PACKAGE_VAR"],"requiredFiles":["package.json"]}');
    const failed=run(['check','--json']);assert.equal(failed.status,1);assert.equal(JSON.parse(failed.stdout).passed,false);
    await writeFile(join(dir,'sample.env'),'PREFLIGHT_PACKAGE_VAR=example');
    const passed=run(['check','--env-file','sample.env','--json']);assert.equal(passed.status,0,passed.stderr);assert.equal(JSON.parse(passed.stdout).passed,true);
    const invalid=run(['check','--env-file','missing','--json']);assert.equal(invalid.status,2);assert.equal(JSON.parse(invalid.stdout).error.code,'ENV_FILE_INVALID');
  }finally{await rm(dir,{recursive:true,force:true});}
});
