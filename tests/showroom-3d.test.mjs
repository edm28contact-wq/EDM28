import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import data from '../showroom-3d-data.js';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('showroom limits actions to 6 educational components offered by EDM28', () => {
  assert.equal(data.parts.length,6);
  assert.equal(data.wheels.length,4);
  for(const wheel of data.wheels){
    const parts=data.forWheel(wheel.id);
    assert.ok(parts.some(part=>part.id==='disques'));
    assert.ok(parts.some(part=>part.id==='plaquettes'));
    assert.ok(wheel.front ? parts.some(part=>part.id==='triangles') : parts.every(part=>part.id!=='triangles'));
  }
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

test('showroom replaces Gemini UI, keeps fallback, and loads pinned Three.js modules', async()=>{
 const [seo,page,css,scene,js]=await Promise.all([
  read('public-seo.js'),read('showroom-3d-page.js'),read('public-site.css'),read('showroom-3d.js'),read('public-site.js')
 ]);
 assert.match(seo,/render3DShowroom\(\)/);
 assert.match(seo,/geminiFaqConfigured = false/);
 assert.match(seo,/type="importmap"/);
 assert.match(seo,/three@0\.181\.2/);
 assert.match(seo,/showroom-3d-data\.js/);
 assert.match(seo,/type=\\"module\\" src=\\"\/showroom-3d\.js/);
 assert.match(page,/edm3dShowroom/);
 assert.match(page,/edm3dFallback/);
 assert.match(page,/edm3dWheelChoice/);
 assert.match(page,/data-edm-wheel=/);
 assert.match(css,/edm3d-ready \.edm3d-fallback/);
 assert.match(scene,/new THREE\.WebGLRenderer/);
 assert.match(scene,/OrbitControls/);
 assert.match(scene,/wheelParts\.get\(item\.id\)\.visible=selected/);
 assert.match(scene,/root\.classList\.add\('edm3d-ready'\)/);
 assert.match(scene,/redWheel/);
 assert.match(scene,/rear wing/i);
 assert.ok(js.length>0);
});
test('reference design remains a procedural model and does not embed unauthorized image URLs', async()=>{
 const source=await read('showroom-3d.js');
 assert.match(source,/from the user's four Porsche GT3 RS photographs/);
 assert.ok(!source.includes('autoproyecto.com'));
 assert.ok(!source.includes('images.porsche.com'));
 assert.match(source,/Math\.min\(window\.devicePixelRatio \|\| 1, 1\.7\)/);
 assert.match(source,/prefers-reduced-motion/);
 assert.match(source,/IntersectionObserver/);
 assert.match(source,/ResizeObserver/);
});
