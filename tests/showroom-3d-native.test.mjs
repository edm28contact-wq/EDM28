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
  assert.match(seo,/showroom-gt3-native-viewer\.js\?v=[\w.-]+/);
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
    const bodyBounds=new THREE.Box3().setFromObject(model.body);
    const bodySize=bodyBounds.getSize(new THREE.Vector3());
    assert.ok(bodySize.x>1.5&&bodySize.x<3,'body width must match its wheel assemblies');
    assert.ok(bodySize.y>.9&&bodySize.y<2.5,'body height must stay within the camera framing');
    assert.ok(bodySize.z>4&&bodySize.z<6.5,'body length must stay within the camera framing');
    const checkedGeometry=new Set();
    model.root.traverse(mesh=>{
      if(!mesh.isMesh||checkedGeometry.has(mesh.geometry))return;
      checkedGeometry.add(mesh.geometry);
      for(const attribute of ['position','normal']){
        const values=mesh.geometry.getAttribute(attribute)?.array;
        assert.ok(values?.length,mesh.name+' is missing '+attribute);
        assert.ok(values.every(Number.isFinite),mesh.name+' contains non-finite '+attribute);
      }
    });
    model.setDisassembly(null,'freinage',0);
    for(const [id,wheel] of model.wheels){
      for(const part of ['roue','disques','etrier'])
        assert.equal(wheel.nodes.get(part).visible,true,id+' '+part+' must remain visible through the open rim');
      for(const family of wheel.front?['freinage','liaison']:['freinage']){
        const order=data.stepsForWheel(id,family).map(stage=>stage.id);
        for(let stage=1;stage<=order.length;stage++){
          model.setDisassembly(id,family,stage);
          model.animate(1);
          for(const [otherId,other] of model.wheels){
            for(const part of order){
              const moved=other.nodes.get(part).position.length()>0;
              assert.equal(moved,otherId===id&&order.indexOf(part)<stage,otherId+' '+part+' moved at the wrong stage');
            }
          }
        }
        model.setDisassembly(id,family,0);
        model.animate(1);
        for(const part of order)assert.equal(wheel.nodes.get(part).position.length(),0,id+' '+part+' not rebuilt');
      }
    }
    assert.equal(model.animate(.15),false,'settled geometry must not request another GPU render');
    model.setDisassembly('av-droite','freinage',1);
    assert.equal(model.animate(.15),true,'moving geometry must request a render');
    model.animate(1);
    assert.equal(model.animate(.15),false,'completed movement must stop requesting renders');
    const picked=model.pickables.find(mesh=>mesh.userData.wheelId==='av-droite'&&mesh.userData.partId==='disques');
    assert.deepEqual(model.toDataPart(picked),{wheelId:'av-droite',part:'disques'});
  }finally{
    model.dispose();
  }
});
