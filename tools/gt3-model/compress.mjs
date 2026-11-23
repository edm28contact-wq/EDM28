import {NodeIO} from './deps/node_modules/@gltf-transform/core/dist/index.modern.js';
import {ALL_EXTENSIONS,EXTTextureWebP} from './deps/node_modules/@gltf-transform/extensions/dist/index.modern.js';
import {draco} from './deps/node_modules/@gltf-transform/functions/dist/functions.modern.js';
import draco3d from './deps/node_modules/draco3d/draco3d.js';
import {stat,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {basename} from 'node:path';

const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},manifest:{type:'string'},'texture-replacements':{type:'string'},audit:{type:'string'},help:{type:'boolean'}}});
if(values.help){
  console.log('Usage: node compress.mjs --input source.glb --output final.glb --manifest manifest.json --texture-replacements texture-replacements.json --audit compression-audit.json');
  process.exit(0);
}
for(const key of ['input','output','manifest','texture-replacements','audit'])if(!values[key])throw new Error(`Missing --${key}`);

const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder':await draco3d.createEncoderModule(),
  'draco3d.decoder':await draco3d.createDecoderModule()
});
const input=values.input;
const output=values.output;
const doc=await io.read(input);
const replacements=JSON.parse(await readFile(values['texture-replacements'],'utf8'));
const byHash=new Map(replacements.filter(r=>r.changed).map(r=>[r.sha256,r]));
let webpCount=0;
for(const texture of doc.getRoot().listTextures()){
  const image=texture.getImage();
  const replacement=image&&byHash.get(createHash('sha256').update(image).digest('hex'));
  if(!replacement)continue;
  texture.setImage(new Uint8Array(await readFile(replacement.path))).setMimeType(replacement.mimeType);webpCount++;
}
if(webpCount)doc.createExtension(EXTTextureWebP).setRequired(true);
const groupsBefore=doc.getRoot().listNodes().filter(n=>/^(av|ar)-(gauche|droite)__[^_]+$/.test(n.getName())).map(n=>({name:n.getName(),extras:n.getExtras()}));
await doc.transform(draco({method:'edgebreaker',encodeSpeed:5,decodeSpeed:5,quantizePosition:16,quantizeNormal:12,quantizeTexcoord:16,quantizeColor:10,quantizeGeneric:14}));
await io.write(output,doc);
const decoded=await io.read(output),root=decoded.getRoot();
const groupsAfter=root.listNodes().filter(n=>/^(av|ar)-(gauche|droite)__[^_]+$/.test(n.getName())).map(n=>({name:n.getName(),extras:n.getExtras()}));
if(JSON.stringify(groupsBefore)!==JSON.stringify(groupsAfter))throw new Error('Group metadata changed during compression');
const triangles=root.listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0);
const result={inputBytes:(await stat(input)).size,outputBytes:(await stat(output)).size,sha256:createHash('sha256').update(await readFile(output)).digest('hex'),nodeCount:root.listNodes().length,meshCount:root.listMeshes().length,materialCount:root.listMaterials().length,textureCount:root.listTextures().length,triangleCount:triangles,groupCount:groupsAfter.length,groups:groupsAfter,extensions:root.listExtensionsUsed().map(e=>e.extensionName),losslessWebpTextures:webpCount};
await writeFile(values.audit,JSON.stringify(result,null,2));
const manifestPath=values.manifest;
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
manifest.asset={filename:basename(output),bytes:result.outputBytes,sha256:result.sha256,triangleCount:triangles,extensions:result.extensions,draco:{positionBits:16,normalBits:12,texcoordBits:16},losslessWebpTextures:webpCount};
manifest.textureOptimization=replacements.map(({path,...record})=>record);
await writeFile(manifestPath,JSON.stringify(manifest,null,2));
console.log(JSON.stringify(result));
