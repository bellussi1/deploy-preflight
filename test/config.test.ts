import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Missing defaults, permissive validation or raw parser errors break these contracts.
test('loads defaults and anchors relative files to the configuration directory', async () => {
  const { loadConfig } = await import('../dist/config.js');
  const dir = await mkdtemp(join(tmpdir(), 'preflight-'));
  try {
    await writeFile(join(dir, 'config.json'), JSON.stringify({urls:[{name:'Health',env:'API'}]}));
    const result = await loadConfig(join(dir, 'config.json'));
    assert.equal(result.baseDir, dir);
    assert.deepEqual(result.config, {requiredEnv:[],requiredFiles:[],urls:[{name:'Health',env:'API',expectedStatus:200,timeoutMs:5000}]});
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('rejects invalid configuration without disclosing input', async () => {
  const { loadConfig, ConfigError } = await import('../dist/config.js');
  const dir = await mkdtemp(join(tmpdir(), 'preflight-'));
  const invalid = [null,[],{extra:true},{requiredEnv:[42]},{requiredEnv:['']},{requiredFiles:[' ']},
    {urls:[{name:'x'}]},{urls:[{name:'x',env:'API',url:'https://example.com'}]},
    {urls:[{name:'x',env:'API',extra:1}]},{urls:[{name:'x',env:'API',expectedStatus:600}]},
    {urls:[{name:'x',env:'API',expectedStatus:199.5}]},{urls:[{name:'x',env:'API',timeoutMs:99}]},
    {urls:[{name:'x',env:'API',timeoutMs:30001}]}];
  try {
    for (const value of invalid) {
      await writeFile(join(dir,'config.json'),JSON.stringify(value));
      await assert.rejects(loadConfig(join(dir,'config.json')),ConfigError);
    }
    await writeFile(join(dir,'config.json'),'{"SECRET_SENTINEL":');
    await assert.rejects(loadConfig(join(dir,'config.json')), error => {
      assert.ok(error instanceof ConfigError);
      assert.ok(!String(error).includes('SECRET_SENTINEL')); return true;
    });
  } finally { await rm(dir,{recursive:true,force:true}); }
});

