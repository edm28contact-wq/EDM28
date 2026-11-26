import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {render3DShowroom} from '../showroom-gt3-native-page.js';
import data from '../showroom-3d-data.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const assetPath='assets/models/edm28-gt3-hybrid-v1.glb';
const manifestPath='assets/models/edm28-gt3-hybrid-v1.json';
const knownParts=new Set(['roue','etrier','moyeu',...data.parts.map(part=>part.id)]);
let assetPromise;
function readAsset(){
  return assetPromise??=readFile(new URL('../'+assetPath,import.meta.url)).then(bytes=>{
    assert.equal(bytes.readUInt32LE(0),0x46546c67,'asset must be a GLB');
    assert.equal(bytes.readUInt32LE(4),2,'asset must use glTF 2');
    assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB length must match the file');
    const length=bytes.readUInt32LE(12);
    assert.equal(bytes.readUInt32LE(16),0x4e4f534a,'first GLB chunk must contain JSON');
    assert.ok(length>0&&20+length<=bytes.length,'GLB JSON chunk is truncated');
    const gltf=JSON.parse(bytes.subarray(20,20+length).toString('utf8'));
    assert.equal(gltf.asset.version,'2.0');
    return gltf;
  });
}
function partGroups(gltf){
  const wheels=new Map(data.wheels.map(wheel=>[wheel.id,new Map()]));
  const parents=new Map();
  for(const [index,node] of gltf.nodes.entries())for(const child of node.children||[]){
    assert.ok(!parents.has(child),'GLB node has multiple parents');
    parents.set(child,index);
  }
  for(const [index,node] of gltf.nodes.entries()){
    const {wheelId,partId}=node.extras||{};
    if(wheelId==null)continue;
    assert.ok(wheels.has(wheelId),'unknown wheel '+wheelId);
    assert.ok(knownParts.has(partId),'unknown part '+partId);
    let nested=false;
    for(let parent=parents.get(index);parent!==undefined;parent=parents.get(parent)){
      const tags=gltf.nodes[parent].extras||{};
      if(tags.wheelId===wheelId&&tags.partId===partId){nested=true;break;}
    }
    if(nested)continue;
    assert.equal(node.name,wheelId+'__'+partId,'part group must have an unambiguous name');
    assert.ok(!wheels.get(wheelId).has(partId),'duplicate group '+node.name);
    wheels.get(wheelId).set(partId,{node,index});
  }
  return wheels;
}
test('native showroom loads the credited local GLB asynchronously without an external iframe',async()=>{
  const [seo,viewer,body,html,css]=await Promise.all([
    source('public-seo.js'),source('showroom-gt3-native-viewer.js'),
    source('showroom-gt3-imported-model.js'),Promise.resolve(render3DShowroom()),
    source('public-site.css')
  ]);
  assert.match(seo,/from '\.\/showroom-gt3-native-page\.js'/);
  assert.match(seo,/showroom-gt3-native-viewer\.js\?v=[\w.-]+/);
  assert.match(html,/data-view="native"/);
  assert.match(html,/id="edm3dCanvas"[^>]*aria-busy="true"/);
  assert.match(html,/edm3d-wheel-shortcuts[^>]*role="group"/);
  assert.doesNotMatch(html,/<iframe/i);
  for(const credit of ['VTDAT23','musiss','549c25c48c474274be5373f1f2fe20a8','73a595bff7d5498fa1891c4a78787d26'])
    assert.ok(html.includes(credit),'missing source credit '+credit);
  assert.match(html,/creativecommons\.org\/licenses\/by\/4\.0/);
  assert.match(viewer,/await createGt3ImportedModel\(THREE[,)]/);
  assert.match(viewer,/model\.raycastTargets/);
  assert.match(viewer,/model\.setDisassembly\(chosenWheel,family,step\)/);
  assert.match(viewer,/model\.animate\(t\)/);
  assert.match(css,/GT3 EDM28 — native/);
  assert.match(body,/three\/addons\/loaders\/GLTFLoader\.js/);
  assert.ok(body.includes('/'+assetPath));
  assert.doesNotMatch(viewer+body,/createGt3NativeModel|createGt3Body|createGt3Wheel|createWorkshopHD/);
});
test('the imported asset identifies all four wheels and only real independently grouped parts',async()=>{
  const [gltf,manifest]=await Promise.all([readAsset(),source(manifestPath).then(JSON.parse)]);
  const wheels=partGroups(gltf);
  assert.deepEqual(Object.keys(manifest.wheels).sort(),data.wheels.map(wheel=>wheel.id).sort());
  assert.deepEqual(manifest.coordinateSystem,{up:'+Y',front:'+Z',vehicleLeft:'+X',mirrored:false});
  for(const role of ['appearance','mechanics'])assert.match(manifest.sourceSha256[role],/^[0-9a-f]{64}$/);
  const owners=new Map();
  for(const [id,parts] of wheels){
    assert.ok(parts.has('roue'),id+' wheel is missing');
    assert.deepEqual([...parts.keys()].sort(),[...manifest.wheels[id].parts].sort(),id+' differs from the audited export');
    assert.ok(!parts.has('plaquettes'),'unidentified pads must not become a fabricated disassembly step');
    assert.equal(parts.has('rotules'),id.startsWith('av-'),'only the source front steering joints are independently grouped');
    for(const [part,group] of parts){
      const audit=manifest.groups.filter(item=>item.wheelId===id&&item.partId===part);
      assert.equal(audit.length,1,id+'/'+part+' must have one source audit');
      assert.equal(audit[0].sourceAsset,part==='roue'?'red-weissach':'gray-gt3-rs');
      let meshCount=0,triangles=0;
      const visit=index=>{
        assert.ok(Number.isInteger(index)&&gltf.nodes[index],'invalid node index');
        assert.ok(!owners.has(index),'part groups overlap at '+gltf.nodes[index].name);
        owners.set(index,id+'/'+part);
        const node=gltf.nodes[index];
        if(Number.isInteger(node.mesh)){
          assert.ok(gltf.meshes[node.mesh]?.primitives?.length,'part has no geometry');
          for(const primitive of gltf.meshes[node.mesh].primitives){
            assert.equal(primitive.mode??4,4,'audited parts must contain triangles');
            const accessor=gltf.accessors[primitive.indices??primitive.attributes.POSITION];
            assert.ok(accessor?.count>0,'part primitive has no vertices');
            triangles+=accessor.count/3;
          }
          meshCount++;
        }
        for(const child of node.children||[])visit(child);
      };
      visit(group.index);
      assert.ok(meshCount>0,id+'/'+part+' is empty');
      assert.equal(triangles,audit[0].sources.reduce((sum,item)=>sum+item.triangles,0),id+'/'+part+' must preserve its audited source triangles');
    }
  }
  assert.ok(gltf.nodes.some((node,index)=>Number.isInteger(node.mesh)&&!owners.has(index)),'body geometry must remain separate from the removable parts');
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
test('the GLB preserves finite transforms and embeds its geometry and textures',async()=>{
  const gltf=await readAsset();
  for(const node of gltf.nodes){
    for(const [attribute,count] of [['translation',3],['rotation',4],['scale',3],['matrix',16]]){
      if(node[attribute]===undefined)continue;
      assert.equal(node[attribute].length,count,node.name+' invalid '+attribute);
      assert.ok(node[attribute].every(Number.isFinite),node.name+' non-finite '+attribute);
    }
  }
  for(const buffer of gltf.buffers||[])assert.ok(!buffer.uri,'geometry must not depend on an external buffer URL');
  assert.ok(gltf.images?.length>0,'the imported asset must include its source textures');
  for(const image of gltf.images){
    assert.ok(Number.isInteger(image.bufferView)&&gltf.bufferViews[image.bufferView],'texture must be embedded in the GLB');
    assert.ok(!image.uri,'texture must not depend on an external URL');
  }
});
