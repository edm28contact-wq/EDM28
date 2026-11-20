import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {render3DShowroom} from '../showroom-gt3-native-page.js';
import {GT3_WHEEL_POSITIONS,GT3_REMOVAL_OFFSETS,createGt3NativeModel} from '../showroom-gt3-native-model.js';
import data from '../showroom-3d-data.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('native GT3 showroom is a single original and fully editable Three.js scene',async()=>{
  const [seo,viewer,body,html,css]=await Promise.all([
    source('public-seo.js'),source('showroom-gt3-native-viewer.js'),
    source('showroom-gt3-native-model.js'),Promise.resolve(render3DShowroom()),
    source('public-site.css')
  ]);
  assert.match(seo,/from '\.\/showroom-gt3-native-page\.js'/);
  assert.match(seo,/showroom-gt3-native-viewer\.js\?v=1/);
  assert.match(html,/data-view="native"/);
  assert.match(html,/id="edm3dCanvas"/);
  assert.doesNotMatch(html,/<iframe|sketchfab\.com/i);
  assert.match(viewer,/createGt3NativeModel\(THREE\)/);
  assert.match(viewer,/raycaster\.intersectObjects\(model\.pickables,false\)/);
  assert.match(viewer,/model\.setDisassembly\(chosenWheel,family,step\)/);
  assert.match(viewer,/model\.animate\(t\)/);
  assert.match(css,/GT3 EDM28 — native/);
  assert.doesNotMatch(body,/Sketchfab|static\.sketchfab\.com/i);
});
test('four independently clickable and removable GT3 wheel assemblies with complete braking and front suspension stages',()=>{
  assert.equal(GT3_WHEEL_POSITIONS.length,4);
  assert.deepEqual(GT3_WHEEL_POSITIONS.map(w=>w.id),data.wheels.map(w=>w.id));
  assert.deepEqual(GT3_WHEEL_POSITIONS.filter(w=>w.front).map(w=>w.id),['av-gauche','av-droite']);
  assert.equal(Object.keys(GT3_REMOVAL_OFFSETS).length,9);
  for(const family of ['freinage','liaison']){
    for(const wheel of data.wheels){
      const steps=data.stepsForWheel(wheel.id,family);
      for(const stage of steps){
        assert.ok(GT3_REMOVAL_OFFSETS[stage.id],stage.id+' has no 3D movement');
      }
      if(!wheel.front&&family==='liaison')assert.deepEqual(steps,[]);
    }
  }
});
test('each interactive stage is exposed with distinct selectable pieces, step navigation and an independent info panel',()=>{
  const html=render3DShowroom();
  const ids=[
    'edm3dWheelChoice','edm3dRotate','edm3dZoomIn','edm3dZoomOut','edm3dReset',
    'edm3dInspection','edm3dFamilyFreinage','edm3dFamilyLiaison',
    'edm3dStepLabel','edm3dStepDescription','edm3dStepProgress',
    'edm3dPrevStep','edm3dNextStep','edm3dRebuild',
    'edm3dParts','edm3dPartTitle','edm3dPartBody','edm3dStatus'
  ];
  for(const id of ids)assert.ok(html.includes('id="'+id+'"'),id+' missing');
  assert.equal((html.match(/data-edm-wheel="/g)||[]).length,4);
  assert.ok(!html.includes('edm3dPickPart'));
  assert.ok(!html.includes('edm3dReferenceFrame'));
});
test('dynamic native model has four independent wheel and brake assemblies (real THREE)',{skip:!process.env.EDM_NATIVE_RUNTIME_TEST},async()=>{
  const THREE=await import('three');
  const model=createGt3NativeModel(THREE);
  try{
    assert.equal(model.wheels.size,4);
    const allWheelNodes=[];
    for(const [id,wheel] of model.wheels){
      assert.ok(wheel.instance.parent===model.root,id);
      for(const part of ['roue','etrier','plaquettes','disques','moyeu']){
        assert.ok(wheel.nodes.has(part),part+' absent from '+id);
        assert.ok(wheel.nodes.get(part).children.length>0,part+' empty');
      }
      assert.ok(model.pickables.some(mesh=>mesh.userData.wheelId===id&&mesh.userData.partId==='roue'));
      allWheelNodes.push(wheel.nodes.get('roue'));
    }
    assert.equal(new Set(allWheelNodes).size,4,'wheels must be independently manipulable');
    assert.ok(model.body.children.length>20,'body should include a roof, aero package, lights and unique body geometry');
    const front=model.wheels.get('av-gauche').nodes.get('roue');
    const rear=model.wheels.get('ar-gauche').nodes.get('roue');
    model.setDisassembly('av-gauche','freinage',1);
    assert.ok(front.userData.target.length()>0);
    assert.equal(rear.userData.target.length(),0);
    model.animate(1);
    assert.ok(front.position.length()>0);
    model.setDisassembly('av-gauche','freinage',5);
    model.animate(1);
    for(const part of ['roue','etrier','plaquettes','disques','moyeu'])
      assert.ok(model.wheels.get('av-gauche').nodes.get(part).position.length()>0,part+' not removed');
    model.setDisassembly('av-gauche','freinage',0);
    model.animate(1);
    for(const part of ['roue','etrier','plaquettes','disques','moyeu'])
      assert.equal(model.wheels.get('av-gauche').nodes.get(part).position.length(),0,part+' not rebuilt');
    model.setDisassembly('av-droite','liaison',5);
    model.animate(1);
    for(const part of ['triangles','rotules','stabilisation','amortisseur'])
      assert.ok(model.wheels.get('av-droite').nodes.get(part).position.length()>0,part+' cannot be removed');
    const picked=model.pickables.find(mesh=>mesh.userData.wheelId==='av-droite'&&mesh.userData.partId==='disques');
    assert.deepEqual(model.toDataPart(picked),{wheelId:'av-droite',part:'disques'});
  }finally{
    model.dispose();
  }
});
