import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import data from '../showroom-3d-data.js';
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

test('showroom replaces Gemini UI, keeps fallback, and loads pinned Three.js modules', async()=>{
 const [seo,page,css,scene,js]=await Promise.all([
  read('public-seo.js'),read('showroom-3d-page.js'),read('public-site.css'),read('showroom-3d.js'),read('public-site.js')
 ]);
 assert.match(seo,/render3DShowroom\(\)/);
 assert.match(seo,/geminiFaqConfigured = false/);
 assert.match(seo,/type="importmap"/);
 assert.match(seo,/three@0\.181\.2/);
 assert.match(seo,/showroom-3d-data\.js/);
 assert.ok(seo.includes("showroom-3d.js?v=5"));
 assert.match(page,/edm3dShowroom/);
 assert.match(page,/edm3dFallback/);
 assert.match(page,/edm3dWheelChoice/);
 assert.match(page,/data-edm-wheel=/);
 assert.match(css,/edm3d-ready \.edm3d-fallback/);
 assert.match(scene,/new THREE\.WebGLRenderer/);
 assert.match(scene,/OrbitControls/);
 assert.match(scene,/component\.visible=selected/);
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

test('realistic licensed reference remains opt-in and mechanic interactions stay available', async () => {
 const [page, scene, css] = await Promise.all([
  read('showroom-3d-page.js'), read('showroom-3d.js'), read('public-site.css')
 ]);
 assert.match(page, /data-view="reference"/);
 assert.match(page, /edm3dLoadReference/);
 assert.match(page, /edm3dViewMechanics/);
 assert.match(page, /edm3dViewReference/);
 assert.match(page, /data-src="https:\/\/sketchfab\.com\/models\/5fd62615f72a4012a5ebc15cd4c64461\/embed/);
 assert.doesNotMatch(page, /<iframe[^>]+\ssrc=/);
 assert.match(page, /jasonUWU/);
 assert.match(page, /CC BY 4\.0/);
 assert.match(scene, /referenceFrame\.src=target/);
 assert.match(scene, /setShowroomView\('mechanics'\)/);
 assert.match(scene, /root\.dataset\.view=mechanics\?'mechanics':'reference'/);
 assert.match(css, /\[data-view=mechanics\] \.edm3d-reference\{display:none\}/);
});

test('four-wheel guided disassembly is reversible and respects axle families', async()=>{
 const [page,scene,seo,css]=await Promise.all([
  read('showroom-3d-page.js'),read('showroom-3d.js'),read('public-seo.js'),read('public-site.css')
 ]);
 const front=data.stepsForWheel('av-droite','freinage');
 assert.deepEqual(front.map(step=>step.id),['roue','etrier','plaquettes','disques','moyeu']);
 assert.deepEqual(data.stepsForWheel('ar-gauche','freinage').map(step=>step.id),front.map(step=>step.id));
 assert.deepEqual(data.stepsForWheel('av-gauche','liaison').map(step=>step.id),['roue','triangles','rotules','stabilisation','amortisseur']);
 assert.deepEqual(data.stepsForWheel('ar-droite','liaison'),[]);
 assert.deepEqual(data.stepsForWheel('absent','freinage'),[]);
 assert.deepEqual(data.stepsForWheel('av-droite','unknown'),[]);
 for(const step of [...front,...data.stepsForWheel('av-gauche','liaison')]){
  assert.ok(step.description.length>60);
 }
 for(const id of ['edm3dInspection','edm3dFamilyFreinage','edm3dFamilyLiaison','edm3dStepLabel','edm3dPrevStep','edm3dNextStep','edm3dRebuild']){
  assert.ok(page.includes('id="'+id+'"'),id+' missing from markup');
  assert.ok(scene.includes("el('"+id+"')"),id+' not connected');
 }
 assert.match(scene,/wheelMechanics\.set\(wheel\.id,elements\)/);
 assert.match(scene,/function applyExploded\(\)/);
 assert.match(scene,/function focusOnWheel\(id\)/);
 assert.match(scene,/function setStep\(value\)/);
 assert.match(scene,/function setFamily\(family\)/);
 assert.match(scene,/camera\.position\.lerp\(cameraAnimation\.position/);
 assert.match(scene,/node\.position\.lerp\(node\.userData\.target,step\)/);
 assert.match(scene,/currentStep=Math\.max\(0,Math\.min\(/);
 assert.match(css,/\.edm3d-inspection\[hidden\]\{display:none\}/);
 assert.match(seo,/showroom-3d-data\.js\?v=2/);
 assert.match(seo,/showroom-3d\.js\?v=5/);
 assert.match(seo,/public-site\.css\?v=12/);
});

test('workshop HD renders an independent detailed brake and suspension assembly in production', async ()=>{
 const [scene,detail,page,seo]=await Promise.all([
   read('showroom-3d.js'),read('showroom-workshop-hd.js'),read('showroom-3d-page.js'),read('public-seo.js')
 ]);
 assert.match(scene,/import \{ createWorkshopHD \} from '\.\/showroom-workshop-hd\.js'/);
 assert.match(scene,/const workshopHD=createWorkshopHD\(THREE\)/);
 assert.match(scene,/scene\.add\(workshopHD\.root\)/);
 assert.match(scene,/car\.visible=false/);
 assert.match(scene,/workshopHD\.animate\(step\)/);
 assert.match(scene,/raycaster\.intersectObjects\(workshopHD\.pickables,false\)/);
 assert.match(scene,/workshopHD\.dispose\(\)/);
 assert.match(detail,/new THREE\.MeshPhysicalMaterial/);
 assert.match(detail,/new THREE\.ExtrudeGeometry/);
 assert.match(detail,/new THREE\.TubeGeometry/);
 assert.match(detail,/new THREE\.CatmullRomCurve3/);
 assert.match(detail,/const rotor=group\('disques'\)/);
 assert.match(detail,/const caliper=group\('etrier'\)/);
 assert.match(detail,/const pads=group\('plaquettes'\)/);
 assert.match(detail,/const hub=group\('moyeu'\)/);
 assert.match(detail,/const strut=group\('amortisseur'\)/);
 assert.match(detail,/const control=group\('triangles'\)/);
 assert.match(detail,/const steering=group\('rotules'\)/);
 assert.match(detail,/const stabilizer=group\('stabilisation'\)/);
 assert.match(detail,/const wheel=group\('roue'\)/);
 assert.match(detail,/function setState\(/);
 assert.match(detail,/const brakeOrder=\['roue','etrier','plaquettes','disques','moyeu'\]/);
 assert.match(detail,/const suspensionOrder=\['roue','triangles','rotules','stabilisation','amortisseur'\]/);
 assert.match(page,/Atelier HD/);
 assert.match(seo,/showroom-3d\.js\?v=5/);
 assert.doesNotMatch(detail,/sketchfab\.com/);
});
