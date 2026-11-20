import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import data from '../showroom-3d-data.js';
import {classifyNodeName,mapModelNodes,createGt3Workshop} from '../showroom-gt3-workshop.js';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('showroom represents 7 educational components while linking only active EDM28 services', () => {
  assert.equal(data.parts.length,7);
  assert.equal(data.wheels.length,4);
  for(const wheel of data.wheels){
    const parts=data.forWheel(wheel.id);
    assert.ok(parts.some(part=>part.id==='disques'));
    assert.ok(parts.some(part=>part.id==='plaquettes'));
    assert.ok(wheel.front ? parts.some(part=>part.id==='triangles') : parts.every(part=>part.id!=='triangles'));
  }
 assert.ok(data.byId('amortisseur').choices.length===0);
 assert.equal(data.byId('amortisseur').category,'Liaison au sol');
  assert.equal(data.forWheel('invalid').length,0);
  assert.equal(data.byId('__proto__'),null);
  assert.equal(data.requestUrl('unknown'),'/demande');
  for(const part of data.parts) {
    assert.ok(part.description.length>25);
    assert.ok(part.check.length>20);
    assert.ok(part.replace.length>20);
    assert.ok(part.signs.length>=3);
    for(const choice of part.choices) {
      assert.match(data.requestUrl(choice.slug),/^\/demande\?service=/);
    }
  }
});


test('production showroom no longer loads the non-dismantlable external model',async()=>{
 const [seo,page,viewer]=await Promise.all([
  read('public-seo.js'),read('showroom-gt3-native-page.js'),read('showroom-gt3-native-viewer.js')
 ]);
 assert.match(seo,/showroom-gt3-native-page\.js/);
 assert.match(seo,/showroom-gt3-native-viewer\.js\?v=1/);
 assert.doesNotMatch(seo,/src="\/showroom-3d\.js/);
 assert.match(page,/data-view=/);
 assert.match(viewer,/createGt3NativeModel/);
 assert.match(viewer,/const model=createGt3NativeModel\(THREE\)/);
 assert.doesNotMatch(viewer,/Sketchfab/);
});
