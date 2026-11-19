import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* EDM28 virtual showroom.
   Generic procedural car and cutaway assemblies, educational—not an OEM CAD model. */
const el = id => document.getElementById(id);
const data = window.EDMShowroomData;
const host = el('edm3dCanvas');
const root = el('edm3dShowroom');
const status = el('edm3dStatus');
if (!data || !host || !root) throw new Error('Showroom EDM28 : éléments indispensables absents.');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));
const partButtons = el('edm3dParts');
const info = el('edm3dInfo');
const wheelNames = data.wheels.map(w => w.id);
const live = text => { if (status) status.textContent=text; };
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias:true,alpha:true,powerPreference:'high-performance' });
} catch (_) {
  live('Votre navigateur ne permet pas la 3D. Utilisez les fiches des composants affichées sous la scène.');
  root.classList.add('edm3d-unavailable');
  throw new Error('WebGL indisponible');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.36;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Voiture 3D interactive, utilisez les boutons de roues et de composants pour naviguer');
renderer.domElement.setAttribute('role','img');
renderer.domElement.style.touchAction='pan-y';
const scene = new THREE.Scene();
scene.background=new THREE.Color('#091019');
scene.fog=new THREE.Fog('#091019',13,23);
const camera=new THREE.PerspectiveCamera(41,1,.1,80);
camera.position.set(6.1,3.55,7.6);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,.7,0);
controls.enableDamping=true;
controls.dampingFactor=.065;
controls.minDistance=3.1;
controls.maxDistance=13;
controls.maxPolarAngle=Math.PI*.48;
controls.minPolarAngle=.31;
controls.enablePan=false;
controls.autoRotate=false;
controls.rotateSpeed=.65;

scene.add(new THREE.HemisphereLight('#d3e4ff','#253042',2.1));
const keyLight=new THREE.DirectionalLight('#f8f9ff',3.8);
keyLight.position.set(-3,9,8);
keyLight.castShadow=true;
keyLight.shadow.mapSize.set(1024,1024);
keyLight.shadow.camera.left=-9;
keyLight.shadow.camera.right=9;
keyLight.shadow.camera.top=9;
keyLight.shadow.camera.bottom=-9;
keyLight.shadow.bias=-.0002;
scene.add(keyLight);
const rimLight=new THREE.DirectionalLight('#83bff2',2.5);
rimLight.position.set(5,4,-6);
scene.add(rimLight);
const stage=new THREE.Mesh(
  new THREE.CylinderGeometry(5.7,5.95,.2,90),
  new THREE.MeshStandardMaterial({color:'#192330',metalness:.45,roughness:.48})
);
stage.position.y=-.1;stage.receiveShadow=true;scene.add(stage);
const ring=new THREE.Mesh(
  new THREE.TorusGeometry(5.39,.025,8,100),
  new THREE.MeshBasicMaterial({color:'#68809d',transparent:true,opacity:.46})
);
ring.rotation.x=-Math.PI/2;ring.position.y=.015;scene.add(ring);
const ground=new THREE.Mesh(
  new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#080d13',roughness:.93})
);
ground.rotation.x=-Math.PI/2;ground.position.y=-.225;ground.receiveShadow=true;scene.add(ground);

const paint=new THREE.MeshPhysicalMaterial({
  color:'#a9bacd', metalness:.78, roughness:.23,clearcoat:1,clearcoatRoughness:.18
});
const bumper=new THREE.MeshStandardMaterial({color:'#283343',metalness:.47,roughness:.38});
const glass=new THREE.MeshPhysicalMaterial({color:'#172b43',metalness:.29,roughness:.15,transparent:true,opacity:.92,side:THREE.DoubleSide});
const silver=new THREE.MeshStandardMaterial({color:'#9baabb',metalness:.83,roughness:.28});
const metal=new THREE.MeshStandardMaterial({color:'#6c7d8d',metalness:.8,roughness:.38});
const dark=new THREE.MeshStandardMaterial({color:'#111923',metalness:.3,roughness:.76});
const tireMaterial=new THREE.MeshStandardMaterial({color:'#14171b',roughness:.9});
const brakeMaterial=new THREE.MeshStandardMaterial({color:'#8b959f',metalness:.75,roughness:.32});
const amber=new THREE.MeshStandardMaterial({color:'#ffba7c',metalness:.27,roughness:.3,emissive:'#ba6d33',emissiveIntensity:.28});
const redLamp=new THREE.MeshStandardMaterial({color:'#d44b4a',emissive:'#c3222a',emissiveIntensity:.39});
const headLamp=new THREE.MeshStandardMaterial({color:'#eef7ff',emissive:'#eef7ff',emissiveIntensity:.8});
const boltMaterial=new THREE.MeshStandardMaterial({color:'#cad4dd',metalness:.82,roughness:.23});
const car=new THREE.Group();scene.add(car);
const wheelParts = new Map();
const wheelVisuals = new Map();
const wheelCenters = new Map();
const interactables=[];
const made=[];
const unit=(geo,mat,parent=car,pos=[0,0,0],rot=[0,0,0])=>{
  const obj=new THREE.Mesh(geo,mat);obj.position.set(...pos);obj.rotation.set(...rot);
  obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);made.push(obj);return obj;
};
const box=(size,mat,parent,pos,rot=[0,0,0])=>unit(new THREE.BoxGeometry(...size),mat,parent,pos,rot);
const cyl=(r1,r2,h,mat,parent,pos,rot=[0,0,0])=>unit(new THREE.CylinderGeometry(r1,r2,h,32),mat,parent,pos,rot);
const rod=(a,b,r,mat,parent)=>{
  const p1=new THREE.Vector3(...a),p2=new THREE.Vector3(...b);
  const mid=p1.clone().add(p2).multiplyScalar(.5);
  const obj=unit(new THREE.CylinderGeometry(r,r,p1.distanceTo(p2),12),mat,parent,mid.toArray());
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),p2.clone().sub(p1).normalize());return obj;
};
const tag=(mesh,id,wheelId)=>{mesh.userData.partId=id;mesh.userData.wheelId=wheelId;interactables.push(mesh);return mesh;};
function carBody(){
  const lower=box([1.94,.53,4.38],paint,car,[0,1.11,0]);
  lower.geometry.translate(0,0,0);
  box([2.0,.24,4.45],paint,car,[0,.90,0]);
  box([1.76,.19,1.36],paint,car,[0,1.45,-1.37],[.02,0,0]);
  box([1.79,.19,1.36],paint,car,[0,1.45,1.36]);
  box([1.62,.21,2.05],paint,car,[0,1.79,-.08]);
  box([1.63,.12,2.09],glass,car,[0,1.85,-.07]);
  box([1.77,.25,.52],glass,car,[0,1.63,1.17],[-.57,0,0]);
  box([1.77,.25,.56],glass,car,[0,1.63,-1.23],[.54,0,0]);
  for(const side of [-1,1]){
    box([.04,.54,1.72],glass,car,[side*.82,1.57,-.05]);
    box([.055,.10,1.84],paint,car,[side*.88,1.47,-.07]);
    box([.22,.11,.18],bumper,car,[side*1.02,1.24,.73]);
    box([.13,.07,.8],bumper,car,[side*1.02,.99,-.14]);
    const mirror=box([.25,.13,.35],bumper,car,[side*1.03,1.45,.60]);
    mirror.rotation.y=side*.18;
    for(const zz of [-1.6,1.6]){
      box([.11,.13,.28],zz>0?headLamp:redLamp,car,[side*.80,1.10,zz>0?2.18:-2.18]);
    }
  }
  box([1.82,.32,.21],bumper,car,[0,.79,2.14]);
  box([1.82,.30,.21],bumper,car,[0,.79,-2.14]);
  box([1.09,.16,.06],dark,car,[0,.82,2.265]);
  for(const z of [2.17,-2.17]){
    box([.45,.08,.06],silver,car,[0,1.11,z]);
  }
  box([1.25,.05,.05],metal,car,[0,1.99,-.25]);
}
carBody();

const coords={
  'av-gauche':[-1.0,.55,1.48],
  'av-droite':[1.0,.55,1.48],
  'ar-gauche':[-1.0,.55,-1.48],
  'ar-droite':[1.0,.55,-1.48]
};
function partMaterial(id){
  const color=data.byId(id)?.color||'#b7d6e5';
  return new THREE.MeshStandardMaterial({color,metalness:.57,roughness:.36,emissive:'#090d12',emissiveIntensity:.06});
}
function wheelAssembly(wheel){
  const [x,y,z]=coords[wheel.id], side=wheel.side;
  const wheelShell=new THREE.Group();
  wheelShell.position.set(x,y,z);
  car.add(wheelShell);
  wheelVisuals.set(wheel.id,wheelShell);
  wheelCenters.set(wheel.id,new THREE.Vector3(x,y,z));
  const tire=unit(new THREE.TorusGeometry(.45,.15,14,38),tireMaterial,wheelShell,[side*.065,0,0],[0,Math.PI/2,0]);
  tag(tire,'__wheel__',wheel.id);
  const hub=cyl(.28,.28,.085,silver,wheelShell,[side*.105,0,0],[0,0,Math.PI/2]);
  tag(hub,'__wheel__',wheel.id);
  const inner=cyl(.35,.35,.068,dark,wheelShell,[side*.077,0,0],[0,0,Math.PI/2]);
  tag(inner,'__wheel__',wheel.id);
  for(let j=0;j<7;j++){
    const a=j/7*Math.PI*2;
    const spoke=box([.039,.27,.055],silver,wheelShell,[side*.16,Math.cos(a)*.14,Math.sin(a)*.14],[a,0,0]);
    tag(spoke,'__wheel__',wheel.id);
  }
  const center=cyl(.079,.079,.16,boltMaterial,wheelShell,[side*.18,0,0],[0,0,Math.PI/2]);
  tag(center,'__wheel__',wheel.id);

  const assembly=new THREE.Group();
  assembly.position.set(x-side*.07,y,z);
  car.add(assembly);
  wheelParts.set(wheel.id,assembly);
  const disc=tag(cyl(.34,.34,.058,brakeMaterial,assembly,[side*.01,0,0],[0,0,Math.PI/2]),'disques',wheel.id);
  const ring=unit(new THREE.TorusGeometry(.31,.013,8,30),silver,assembly,[side*.046,0,0],[0,Math.PI/2,0]);
  tag(ring,'disques',wheel.id);
  for(let i=0;i<9;i++){
    const a=i/9*Math.PI*2;
    const hole=unit(new THREE.SphereGeometry(.012,8,6),dark,assembly,[side*.052,Math.cos(a)*.24,Math.sin(a)*.24]);
    tag(hole,'disques',wheel.id);
  }
  const caliper=tag(box([.16,.29,.18],amber,assembly,[side*.15,.06,-.22]),'plaquettes',wheel.id);
  const pad=tag(box([.08,.20,.23],partMaterial('plaquettes'),assembly,[side*.085,.04,-.23]),'plaquettes',wheel.id);
  const hose=rod([side*.13,.05,-.22],[side*.21,.42,-.3],.025,partMaterial('liquide'),assembly);
  tag(hose,'liquide',wheel.id);
  if(wheel.front){
    const triangleMaterial=partMaterial('triangles');
    tag(rod([0,-.08,-.15],[-side*.4,-.32,-.4],.045,triangleMaterial,assembly),'triangles',wheel.id);
    tag(rod([0,-.08,.2],[-side*.4,-.32,-.4],.045,triangleMaterial,assembly),'triangles',wheel.id);
    tag(rod([-side*.10,.04,.0],[-side*.44,.11,.43],.035,partMaterial('rotules'),assembly),'rotules',wheel.id);
    tag(rod([side*.01,.12,-.25],[-side*.28,.64,-.24],.038,partMaterial('stabilisation'),assembly),'stabilisation',wheel.id);
  }
  assembly.visible=false;
}
data.wheels.forEach(wheelAssembly);
const selectableParts=()=>{
  return interactables.filter(o=>o.userData.partId!=='__wheel__' && data.byId(o.userData.partId));
};
let currentWheel=null, currentPart=null, desiredWheelMove=0;
const chosenWheel=()=>data.wheelById(currentWheel);
const availableServices=()=>Array.isArray(window.EDMShowroomActiveServices)?window.EDMShowroomActiveServices:null;
const button=(label,slug)=>data.requestUrl(slug)?'<a class="edm3d-offer" href="'+escape(data.requestUrl(slug))+'">'+escape(label)+'<span aria-hidden="true">↗</span></a>':'';
function setPart(id){
  const part=data.byId(id);
  if(!part)return;
  currentPart=id;
  root.dataset.part=id;
  const wheel=chosenWheel();
  const services=availableServices();
  const options=part.choices.filter(c=>!services||services.includes(c.slug));
  const title=el('edm3dPartTitle');
  const body=el('edm3dPartBody');
  if(title)title.textContent=part.label;
  if(body)body.innerHTML=
    '<p class="edm3d-category">'+escape(part.category)+'</p>'
    +'<p>'+escape(part.description)+'</p>'
    +'<h4>Signes qui peuvent alerter</h4><ul>'+part.signs.map(s=>'<li>'+escape(s)+'</li>').join('')+'</ul>'
    +'<h4>Quand contrôler ?</h4><p>'+escape(part.check)+'</p>'
    +'<h4>Quand remplacer ?</h4><p>'+escape(part.replace)+'</p>'
    +'<div class="edm3d-offers"><h4>Prestations EDM28</h4>'
    +(options.length?options.map(opt=>button(opt.label,opt.slug)).join(''):'<p>Référence à vérifier avec EDM28.</p>')+'</div>';
  partButtons?.querySelectorAll('button').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.part===id)));
  const relevantMeshes=selectableParts();
  relevantMeshes.forEach(mesh=>{
    const material=mesh.material;
    if(!material?.emissive)return;
    material.emissiveIntensity=mesh.userData.partId===id ? .48 : .08;
  });
  live('Composant sélectionné : '+part.label+(wheel?' sur la roue '+wheel.label.toLowerCase():'')+'.');
}
function refreshPartMenu(){
  if(!partButtons)return;
  if(!currentWheel){
    partButtons.innerHTML='<p class="edm3d-empty">Sélectionnez une roue pour découvrir ses composants.</p>';
    return;
  }
  const parts=data.forWheel(currentWheel);
  partButtons.innerHTML=parts.map(part=>
    '<button type="button" data-part="'+escape(part.id)+'" class="edm3d-part-button" aria-pressed="'+String(currentPart===part.id)+'">'
    +'<span class="edm3d-part-dot" style="--dot:'+part.color+'"></span>'+escape(part.label)+'</button>'
  ).join('');
  partButtons.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>setPart(btn.dataset.part)));
}
function showWheel(id){
  const wheel=data.wheelById(id);
  if(!wheel)return;
  if(currentWheel===id){restore();return;}
  if(currentWheel){
    const previous=wheelVisuals.get(currentWheel);
    previous.userData.targetX=0;
    wheelParts.get(currentWheel).visible=false;
  }
  currentWheel=id;currentPart=null;
  root.dataset.wheel=id;
  data.wheels.forEach(item=>{
    const selected=item.id===id;
    const visual=wheelVisuals.get(item.id);
    if(visual)visual.userData.targetX=selected ? item.side*.9:0;
    wheelParts.get(item.id).visible=selected;
  });
  controls.target.set(0,.65,0);
  controls.autoRotate=false;
  const choice=el('edm3dWheelChoice');
  if(choice)choice.value=id;
  const prompt=el('edm3dWheelPrompt');
  if(prompt)prompt.textContent='Roue '+wheel.label.toLowerCase()+' démontée virtuellement : choisissez un composant.';
  const reset=el('edm3dReset');
  if(reset)reset.disabled=false;
  refreshPartMenu();
  setPart(data.forWheel(id)[0]?.id||'disques');
}
function restore(){
  currentWheel=null;currentPart=null;
  delete root.dataset.part; delete root.dataset.wheel;
  for(const wheel of data.wheels){
    const mesh=wheelVisuals.get(wheel.id);
    mesh.userData.targetX=0;
    wheelParts.get(wheel.id).visible=false;
  }
  const selector=el('edm3dWheelChoice');
  if(selector)selector.value='';
  const prompt=el('edm3dWheelPrompt');
  if(prompt)prompt.textContent='Faites tourner la voiture, puis cliquez sur une roue pour la démonter virtuellement.';
  const reset=el('edm3dReset');
  if(reset)reset.disabled=true;
  const title=el('edm3dPartTitle');
  if(title)title.textContent='Choisissez une roue';
  const body=el('edm3dPartBody');
  if(body)body.innerHTML='<p>Sélectionnez une roue pour découvrir le freinage et les éléments de liaison au sol. Les représentations sont génériques et non contractuelles.</p>';
  refreshPartMenu();
  live('Vue complète de la voiture rétablie.');
}
const selectWheel=el('edm3dWheelChoice');
selectWheel?.addEventListener('change',e=>e.target.value?showWheel(e.target.value):restore());
el('edm3dReset')?.addEventListener('click',restore);
el('edm3dRotate')?.addEventListener('click',e=>{
  controls.autoRotate=!controls.autoRotate && !reduceMotion;
  e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));
  e.currentTarget.textContent=controls.autoRotate?'Arrêter la rotation':'Faire tourner la voiture';
});
el('edm3dZoomIn')?.addEventListener('click',()=>{camera.position.sub(controls.target).multiplyScalar(.8).add(controls.target);});
el('edm3dZoomOut')?.addEventListener('click',()=>{camera.position.sub(controls.target).multiplyScalar(1.2).add(controls.target);});
root.querySelectorAll('[data-edm-wheel]').forEach(btn=>btn.addEventListener('click',()=>showWheel(btn.dataset.edmWheel)));
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
let pointerDown=null;
renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!pointerDown)return;
  const delta=Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y);
  pointerDown=null;
  if(delta>8)return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(interactables,false).filter(hit=>hit.object.visible&&hit.object.parent?.visible);
  const partHit=hits.find(hit=>hit.object.userData.partId!=='__wheel__' && currentWheel===hit.object.userData.wheelId);
  if(partHit){setPart(partHit.object.userData.partId);return;}
  const wheelHit=hits.find(hit=>hit.object.userData.partId==='__wheel__');
  if(wheelHit)showWheel(wheelHit.object.userData.wheelId);
});
renderer.domElement.addEventListener('webglcontextlost',e=>{
  e.preventDefault();root.classList.add('edm3d-unavailable');
  live('La scène 3D a été interrompue. Les fiches d’information restent accessibles.');
});
renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
window.EDMShowroomSelectWheel=showWheel;
let frameId=null;
let running=true;
const observer=new IntersectionObserver(items=>{
  running=items.some(item=>item.isIntersecting);
  if(running && frameId===null) frameId=requestAnimationFrame(draw);
},{threshold:.04});
observer.observe(root);
const resize=()=>{
  const width=host.clientWidth||650,height=host.clientHeight||540;
  camera.aspect=width/height;camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
};
const resizer=new ResizeObserver(resize);
resizer.observe(host);
resize();
function draw(){
  frameId=null;
  if(!running || document.hidden)return;
  const step=reduceMotion?1:.13;
  for(const wheel of data.wheels){
    const visual=wheelVisuals.get(wheel.id);
    const end=visual.userData.targetX||0;
    visual.position.x+= (coords[wheel.id][0]+end-visual.position.x)*step;
  }
  controls.update();
  renderer.render(scene,camera);
  frameId=requestAnimationFrame(draw);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&running&&frameId===null)frameId=requestAnimationFrame(draw);});
const cleanup=()=>{
  observer.disconnect();resizer.disconnect();
  if(frameId!==null)cancelAnimationFrame(frameId);
  controls.dispose();renderer.dispose();
  made.forEach(object=>object.geometry?.dispose());
  [...new Set(made.map(object=>object.material))].forEach(material=>material?.dispose?.());
};
window.addEventListener('pagehide',cleanup,{once:true});
restore();
live('Showroom 3D prêt. Faites tourner la voiture ou sélectionnez une roue.');
frameId=requestAnimationFrame(draw);
