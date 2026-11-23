import {NodeIO} from './deps/node_modules/@gltf-transform/core/dist/index.modern.js';
import {ALL_EXTENSIONS} from './deps/node_modules/@gltf-transform/extensions/dist/index.modern.js';
import {weld,draco} from './deps/node_modules/@gltf-transform/functions/dist/functions.modern.js';
import draco3d from './deps/node_modules/draco3d/draco3d.js';
import {writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';

const {values}=parseArgs({options:{input:{type:'string'},final:{type:'string'},report:{type:'string'}}});
for(const key of ['input','final','report'])if(!values[key])throw new Error(`Missing --${key}`);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const source=await io.read(values.input),final=await io.read(values.final);
function snapshot(doc){
  return doc.getRoot().listMeshes().flatMap(mesh=>mesh.listPrimitives().map((prim,index)=>({mesh:mesh.getName(),primitive:index,count:(prim.getIndices()?.getCount()||prim.getAttribute('POSITION').getCount())/3})));
}
const before=snapshot(source);
await source.transform(weld());
const afterWeld=snapshot(source),afterDraco=snapshot(final);
const losses=[];
for(let meshIndex=0;meshIndex<source.getRoot().listMeshes().length;meshIndex++){
  const mesh=source.getRoot().listMeshes()[meshIndex];
  for(let primitive=0;primitive<mesh.listPrimitives().length;primitive++){
    const prim=mesh.listPrimitives()[primitive],key=r=>r.mesh===mesh.getName()&&r.primitive===primitive;
    const original=before.find(key),welded=afterWeld.find(key),compressed=afterDraco.find(key);
    if(original.count===compressed.count)continue;
    const indices=prim.getIndices().getArray(),position=prim.getAttribute('POSITION').getArray(),zeroArea=[];
    for(let k=0;k<indices.length;k+=3){
      const ids=[indices[k],indices[k+1],indices[k+2]],p=ids.map(i=>Array.from(position.slice(i*3,i*3+3)));
      const u=p[1].map((v,i)=>v-p[0][i]),v=p[2].map((v,i)=>v-p[0][i]);
      const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const area=Math.hypot(...cross)/2;
      if(area===0)zeroArea.push({triangle:k/3,indices:ids,positions:p,area,duplicatePosition:p.some((a,i)=>p.some((b,j)=>j>i&&a.every((x,c)=>x===b[c])))});
    }
    const zeroAreaIndices=new Set(zeroArea.map(t=>t.triangle));
    losses.push({mesh:mesh.getName(),primitive,before:original.count,afterWeld:welded.count,afterDraco:compressed.count,zeroAreaTriangles:zeroArea});
    prim.getIndices().setArray(new Uint32Array(Array.from(indices).filter((_,i)=>!zeroAreaIndices.has(Math.floor(i/3)))));
  }
}
const report={before:before.reduce((n,r)=>n+r.count,0),afterWeld:afterWeld.reduce((n,r)=>n+r.count,0),afterDraco:afterDraco.reduce((n,r)=>n+r.count,0),losses};
await source.transform(draco({method:'edgebreaker',encodeSpeed:5,decodeSpeed:5,quantizePosition:16,quantizeNormal:12,quantizeTexcoord:16,quantizeColor:10,quantizeGeneric:14}));
const withoutDegenerate=await io.readBinary(await io.writeBinary(source));
function triangleKeys(primitive){
  const semantics=primitive.listSemantics().sort(),indices=primitive.getIndices().getArray();
  const vertices=Array.from({length:primitive.getAttribute('POSITION').getCount()},(_,i)=>semantics.map(s=>{
    const attribute=primitive.getAttribute(s),size=attribute.getElementSize();
    return s+':'+Array.from(attribute.getArray().slice(i*size,(i+1)*size)).join(',');
  }).join(';'));
  const triangles=[];
  for(let i=0;i<indices.length;i+=3)triangles.push([vertices[indices[i]],vertices[indices[i+1]],vertices[indices[i+2]]].sort().join('|'));
  return triangles.sort();
}
for(const loss of losses){
  const finalPrimitive=final.getRoot().listMeshes().find(m=>m.getName()===loss.mesh).listPrimitives()[loss.primitive];
  const recompressedPrimitive=withoutDegenerate.getRoot().listMeshes().find(m=>m.getName()===loss.mesh).listPrimitives()[loss.primitive];
  loss.recompressedAfterRemovingOnlyZeroAreaFacesMatchesFinal=JSON.stringify(triangleKeys(finalPrimitive))===JSON.stringify(triangleKeys(recompressedPrimitive));
}
await writeFile(values.report,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
