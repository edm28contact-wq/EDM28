import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import handler from '../api/health.js';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const response = () => ({
  statusCode: 0, headers: {}, body: null,
  setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
  status(value) { this.statusCode = value; return this; },
  send(value) { this.body = value; return this; },
  end() { return this; },
  json(value) { this.body = value; return this; }
});

test('deployment includes and explicitly serves the browser journey model', async () => {
  const config = JSON.parse(await read('vercel.json'));
  const route = config.routes.find(row => row.src === '/journey-model.js');
  assert.equal(route?.dest, '/api/health?journey=model');
  assert.ok(config.routes.indexOf(route) < config.routes.findIndex(row => row.handle === 'filesystem'));
  assert.equal(config.functions['api/health.js'].includeFiles, 'journey-model.js');
  const res = response();
  await handler({method:'GET',url:route.dest,query:{journey:'model'}},res);
  assert.equal(res.statusCode,200);
  assert.match(res.headers['content-type'],/application\/javascript/);
  assert.equal(res.headers['x-content-type-options'],'nosniff');
  assert.equal(res.body,await read('journey-model.js'));
  const context={};vm.runInNewContext(res.body,context);
  assert.equal(typeof context.EDMJourneyModel.progress,'function');
});

test('journey source HEAD has no body and POST cannot send an email', async t => {
  let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;throw new Error('Unexpected network request');});
  for(const method of ['HEAD','POST']){
    const res=response();await handler({method,url:'/api/health?journey=model',body:{recipient:'nobody@example.test'}},res);
    assert.equal(res.statusCode,method==='HEAD'?200:405);assert.equal(res.body,null);
  }
  assert.equal(requests,0);
});

test('the public model handler does not accept a user-supplied filename',async()=>{
  const res=response();await handler({method:'GET',url:'/api/health?journey=model&path=../../.env'},res);
  assert.equal(res.body,await read('journey-model.js'));
});
