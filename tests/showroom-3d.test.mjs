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

test('showroom replaces Gemini UI, keeps fallback, and loads pinned Three.js modules', async()=>{
 const [seo,page,css,scene,js]=await Promise.all([
  read('public-seo.js'),read('showroom-3d-page.js'),read('public-site.css'),read('showroom-3d.js'),read('public-site.js')
 ]);
 assert.match(seo,/render3DShowroom\(\)/);
 assert.match(seo,/geminiFaqConfigured = false/);
 assert.match(seo,/type="importmap"/);
 assert.match(seo,/three@0\.181\.2/);
 assert.match(seo,/showroom-3d-data\.js/);
 assert.ok(seo.includes("showroom-3d.js?v=6"));
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
 assert.doesNotMatch(page, /edm3dViewMechanics/);
 assert.match(page, /edm3dModelSupport/);
 assert.match(page, /data-src="https:\/\/sketchfab\.com\/models\/5fd62615f72a4012a5ebc15cd4c64461\/embed/);
 assert.doesNotMatch(page, /<iframe[^>]+\ssrc=/);
 assert.match(page, /jasonUWU/);
 assert.match(page, /CC BY 4\.0/);
 assert.match(scene, /gt3\.init\(\)/);
 assert.doesNotMatch(scene, /setShowroomView\('mechanics'\)/);
 assert.match(scene, /gt3\.setSteps\(wheelId,expected\)/);
 assert.match(css, /A single GT3 RS model is shown/);
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
 assert.match(seo,/showroom-3d\.js\?v=6/);
 assert.match(seo,/public-site\.css\?v=13/);
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
 assert.match(page,/GT3 RS · EXPLORATION INTERACTIVE/);
 assert.match(seo,/showroom-3d\.js\?v=6/);
 assert.doesNotMatch(detail,/sketchfab\.com/);
});

test('GT3 workshop names must identify both axle and side before removing any object',()=>{
  assert.deepEqual(classifyNodeName('Wheel_FL'),{wheel:'av-gauche',part:'wheel'});
  assert.deepEqual(classifyNodeName('tyre - front right'),{wheel:'av-droite',part:'wheel'});
  assert.deepEqual(classifyNodeName('Rotor Rear Left'),{wheel:'ar-gauche',part:'disques'});
  assert.deepEqual(classifyNodeName('Caliper RR'),{wheel:'ar-droite',part:'etrier'});
  assert.equal(classifyNodeName('Bodywork'),null);
  assert.equal(classifyNodeName('Wheel_001'),null);
  assert.equal(classifyNodeName('wheel front'),null);
  const map=mapModelNodes({
    1:{name:'Wheel_FL',instanceID:31},
    2:{name:'Wheel_FR',instanceID:32},
    3:{name:'Rotor Front Left',instanceID:44},
    4:{name:'Chassis',instanceID:45}
  });
  assert.deepEqual(map.available,['av-gauche','av-droite']);
  assert.deepEqual(map.wheels.get('av-gauche').get('wheel'),[31]);
  assert.deepEqual(map.wheels.get('av-gauche').get('disques'),[44]);
  assert.equal(map.names.has(45),false);
});
test('GT3 API does not pretend to remove fused or unnamed wheels',async()=>{
  const oldWindow=globalThis.window;
  const callbacks={},calls=[];
  try{
    globalThis.window={
      Sketchfab:class {
        constructor(version,iframe){assert.equal(version,'1.12.1');assert.equal(iframe.id,'viewer');}
        init(uid,{success}){
          assert.equal(uid,'5fd62615f72a4012a5ebc15cd4c64461');
          const api={
            addEventListener(name,listener){callbacks[name]=listener;},
            getNodeMap(done){done(null,[
              {name:'Wheel_FL',instanceID:5},
              {name:'Rotor Front Left',instanceID:7},
              {name:'Car body',instanceID:80}
            ]);},
            hide(id,done){calls.push(['hide',id]);done(null);},
            show(id,done){calls.push(['show',id]);done(null);}
          };
          success(api);
          queueMicrotask(()=>callbacks.viewerready());
        }
      }
    };
    const warnings=[],ready=[];
    const control=createGt3Workshop({
      iframe:{id:'viewer'},
      onReady:event=>ready.push(event),
      onWarning:message=>warnings.push(message)
    });
    await control.init();
    assert.deepEqual(ready[0].available,['av-gauche']);
    assert.equal(control.supports('av-gauche','wheel'),true);
    assert.equal(control.supports('av-droite','wheel'),false);
    assert.deepEqual(await control.setSteps('av-droite',['wheel']),{ok:false,missing:['wheel']});
    assert.deepEqual(calls,[]);
    assert.deepEqual(await control.setSteps('av-gauche',['wheel','disques']),{ok:true});
    assert.deepEqual(calls,[['hide',5],['hide',7]]);
    await control.restore();
    assert.deepEqual(calls.slice(-2),[['show',5],['show',7]]);
    assert.equal(warnings.some(message=>message.includes('pas séparée')),true);
  }finally{
    if(oldWindow===undefined)delete globalThis.window;
    else globalThis.window=oldWindow;
  }
});
