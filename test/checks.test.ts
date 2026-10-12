import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm,chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { once } from 'node:events';

test('environment preserves empty process values and does not mutate input', async () => {
  const {loadEnvironment} = await import('../dist/environment.js');
  const {checkEnvironment} = await import('../dist/checks.js');
  const dir = await mkdtemp(join(tmpdir(),'preflight-'));
  try {
    const file = join(dir,'.env'); await writeFile(file,'API=file\nOTHER=value');
    const env = {API:'',SPACE:'  ',PRESENT:'secret'};
    const merged = await loadEnvironment(file,env);
    assert.equal(merged.API,''); assert.equal(merged.OTHER,'value'); assert.equal(env.API,'');
    assert.deepEqual(checkEnvironment(['PRESENT','API','SPACE','MISSING'],merged).map(r=>r.passed),[true,false,false,false]);
    assert.ok(!JSON.stringify(checkEnvironment(['PRESENT'],merged)).includes('secret'));
    await assert.rejects(loadEnvironment(join(dir,'missing'),env));
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('files must be readable regular files resolved against baseDir',async t=>{
  const {checkFiles} = await import('../dist/checks.js');
  const dir=await mkdtemp(join(tmpdir(),'preflight-'));
  try {
    await writeFile(join(dir,'exists'),'ok');
    assert.deepEqual((await checkFiles(['exists','missing','.'],dir)).map(r=>r.passed),[true,false,false]);
    if(process.platform !== 'win32' && process.getuid?.() !== 0){
      await chmod(join(dir,'exists'),0);
      assert.equal((await checkFiles(['exists'],dir))[0]?.passed,false);
    } else {t.diagnostic('Unreadable permission case cannot be reproduced reliably on Windows/root.');}
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('URL validation never probes without opt-in and blocks unsafe paths',async()=>{
  const {checkUrls} = await import('../dist/checks.js');
  let hits=0;
  const server=createServer((_req,res)=>{hits++;res.end('SECRET_BODY');});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();assert.ok(address && typeof address !== 'string');
  const url=`http://127.0.0.1:${address.port}`;
  const check=(source:Record<string,unknown>)=>({name:'Health',expectedStatus:200,timeoutMs:500,...source});
  try {
    const results=await checkUrls([check({env:'API',path:'/health'}),check({url:'file:///tmp/a'}),check({url:'http://user:SECRET@localhost'}),check({url,path:'//elsewhere.invalid'}),check({url,path:'http://user:SECRET@localhost'})] as any,{API:url},false);
    assert.deepEqual(results.map(r=>r.passed),[true,false,false,false,false]);assert.equal(hits,0);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('probes classify status, timeout, redirects and connection failures with one time budget',async()=>{
  const {checkUrls} = await import('../dist/checks.js');
  const server=createServer((req,res)=>{
    if(req.url==='/ok')res.end('SECRET_BODY');
    else if(req.url==='/bad'){res.statusCode=503;res.end();}
    else if(req.url==='/timeout')setTimeout(()=>res.end(),500);
    else if(req.url==='/redirect'){res.writeHead(302,{location:'/ok'});res.end();}
    else if(req.url==='/credentials'){res.writeHead(302,{location:'http://user:SECRET@localhost'});res.end();}
    else if(req.url==='/protocol'){res.writeHead(302,{location:'file:///tmp/secret'});res.end();}
    else if(req.url?.startsWith('/slow'))setTimeout(()=>{res.writeHead(302,{location:'/slow2'});res.end();},80);
    else {res.writeHead(302,{location:'/loop'});res.end();}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();assert.ok(address && typeof address!=='string');
  const base=`http://127.0.0.1:${address.port}`;
  const paths=['/ok','/bad','/timeout','/redirect','/loop','/credentials','/protocol','/slow'];
  try {
    const results=await checkUrls(paths.map(path=>({name:'Health',url:base+path,expectedStatus:200,timeoutMs:130})),{},true);
    assert.deepEqual(results.map(r=>r.code),['URL_OK','URL_STATUS','URL_TIMEOUT','URL_OK','URL_REDIRECT_LIMIT','URL_INVALID','URL_INVALID','URL_TIMEOUT']);
    assert.ok(!JSON.stringify(results).includes('SECRET'));
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  const failed=await checkUrls([{name:'Offline',url:base,expectedStatus:200,timeoutMs:500}],{},true);
  assert.equal(failed[0]?.code,'URL_REQUEST_FAILED');
});
test('runner continues after failures in deterministic order',async()=>{
  const {runChecks} = await import('../dist/runner.js');
  const report=await runChecks({requiredEnv:['MISSING'],requiredFiles:['not-there'],urls:[{name:'Health',url:'https://example.com',expectedStatus:200,timeoutMs:500}]},tmpdir(),{},false);
  assert.equal(report.passed,false);assert.deepEqual(report.results.map(r=>r.kind),['env','file','url']);
});

