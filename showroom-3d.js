import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWorkshopHD } from './showroom-workshop-hd.js';
import { createGt3Workshop } from './showroom-gt3-workshop.js';

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
host.querySelector('.edm3d-loading')?.remove();
renderer.domElement.setAttribute('aria-label','Ensemble de freinage et suspension 3D détaillé, pièces interactives');
renderer.domElement.setAttribute('role','img');
renderer.domElement.style.touchAction='pan-y';
const scene = new THREE.Scene();
scene.background=new THREE.Color('#e5e8ec');
scene.fog=null;
const camera=new THREE.PerspectiveCamera(41,1,.1,80);
camera.position.set(4.2,2.85,4.6);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,1.48,0);
controls.enableDamping=true;
controls.dampingFactor=.065;
controls.minDistance=1.4;
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
ground.rotation.x=-Math.PI/2;ground.position.y=-.005;ground.receiveShadow=true;scene.add(ground);
stage.visible=false;ring.visible=false;
ground.material.color.set('#cdd3d9');
scene.add(new THREE.AmbientLight('#ffffff',.75));
const studioEnvironment=new THREE.Scene();
studioEnvironment.background=new THREE.Color('#727c8a');
const softboxMat=new THREE.MeshBasicMaterial({color:'#f8fcff',side:THREE.DoubleSide});
const warmboxMat=new THREE.MeshBasicMaterial({color:'#ded8cf',side:THREE.DoubleSide});
function studioSoftbox(size,position,rotation,material){
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(...size),material);
  plane.position.set(...position);plane.rotation.set(...rotation);studioEnvironment.add(plane);
}
studioSoftbox([8,5],[-5,7,3],[0,Math.PI*.22,0],softboxMat);
studioSoftbox([5,7],[5,5,-2],[0,-Math.PI*.24,0],softboxMat);
studioSoftbox([9,3],[0,8,-4],[-Math.PI*.35,0,0],warmboxMat);
const pmrem=new THREE.PMREMGenerator(renderer);
const studioMap=pmrem.fromScene(studioEnvironment,.04);
scene.environment=studioMap.texture;
pmrem.dispose();
studioEnvironment.traverse(object=>{if(object.isMesh)object.geometry.dispose();});
softboxMat.dispose();warmboxMat.dispose();
const workshopHD=createWorkshopHD(THREE);
scene.add(workshopHD.root);
workshopHD.setState({family:'freinage',step:0});
workshopHD.nodes.get('roue').visible=false;

const paint=new THREE.MeshPhysicalMaterial({
  color:'#e7e9ed', metalness:.46, roughness:.21,clearcoat:1,clearcoatRoughness:.12
});
const bumper=new THREE.MeshStandardMaterial({color:'#283343',metalness:.47,roughness:.38});
const glass=new THREE.MeshPhysicalMaterial({color:'#172b43',metalness:.29,roughness:.15,transparent:true,opacity:.92,side:THREE.DoubleSide});
const silver=new THREE.MeshStandardMaterial({color:'#9baabb',metalness:.83,roughness:.28});
const metal=new THREE.MeshStandardMaterial({color:'#6c7d8d',metalness:.8,roughness:.38});
const dark=new THREE.MeshStandardMaterial({color:'#111923',metalness:.3,roughness:.76});
const tireMaterial=new THREE.MeshStandardMaterial({color:'#14171b',roughness:.9});
const redWheel=new THREE.MeshStandardMaterial({color:'#bd1d33',metalness:.67,roughness:.25});
const blackCarbon=new THREE.MeshStandardMaterial({color:'#11151c',metalness:.45,roughness:.3});
const brakeMaterial=new THREE.MeshStandardMaterial({color:'#8b959f',metalness:.75,roughness:.32});
const amber=new THREE.MeshStandardMaterial({color:'#ffba7c',metalness:.27,roughness:.3,emissive:'#ba6d33',emissiveIntensity:.28});
const redLamp=new THREE.MeshStandardMaterial({color:'#d44b4a',emissive:'#c3222a',emissiveIntensity:.39});
const headLamp=new THREE.MeshStandardMaterial({color:'#eef7ff',emissive:'#eef7ff',emissiveIntensity:.8});
const boltMaterial=new THREE.MeshStandardMaterial({color:'#cad4dd',metalness:.82,roughness:.23});
const car=new THREE.Group();scene.add(car);car.visible=false;
const wheelParts = new Map();
const wheelMechanics = new Map();
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
  // Low front, wide fenders, sloping coupe roof, rear wing and contrasting racing wheels.
  // Loosely proportioned from the user's four Porsche GT3 RS photographs; no OEM geometry.
  const profile=new THREE.Shape();
  profile.moveTo(-2.27,.79);
  profile.lineTo(-2.27,1.03);
  profile.quadraticCurveTo(-2.12,1.24,-1.85,1.28);
  profile.quadraticCurveTo(-1.38,1.38,-1.14,1.63);
  profile.quadraticCurveTo(-.80,1.95,-.21,1.99);
  profile.quadraticCurveTo(.36,2.01,.80,1.73);
  profile.quadraticCurveTo(1.23,1.38,1.73,1.35);
  profile.quadraticCurveTo(2.06,1.29,2.27,1.13);
  profile.lineTo(2.27,.72);
  profile.quadraticCurveTo(1.90,.63,1.62,.66);
  profile.lineTo(-1.78,.66);
  profile.quadraticCurveTo(-2.12,.67,-2.27,.79);
  const bodyGeometry=new THREE.ExtrudeGeometry(profile,{
    depth:1.82,steps:1,bevelEnabled:true,bevelThickness:.045,bevelSize:.05,bevelSegments:3,
    curveSegments:18
  });
  const shell=new THREE.Mesh(bodyGeometry,paint);
  shell.rotation.y=Math.PI/2;
  shell.position.x=-.91;
  shell.castShadow=true;car.add(shell);made.push(shell);
  // Front is +Z and rear is -Z.
  box([1.93,.09,1.03],paint,car,[0,1.30,1.56]);
  box([1.69,.04,1.15],blackCarbon,car,[0,1.48,1.54],[-.11,0,0]);
  box([1.43,.042,1.12],paint,car,[0,1.495,1.54],[-.11,0,0]);
  box([1.90,.17,.19],blackCarbon,car,[0,.72,2.22]);
  box([1.78,.14,.18],blackCarbon,car,[0,.73,-2.21]);
  box([1.15,.12,.06],blackCarbon,car,[0,.87,2.285]);
  box([1.15,.08,.05],redLamp,car,[0,1.18,-2.255]);
  const windshield=box([1.50,.026,.73],glass,car,[0,1.69,.69],[-.55,0,0]);
  windshield.castShadow=false;
  const rearWindow=box([1.40,.027,.70],glass,car,[0,1.68,-1.03],[.65,0,0]);
  rearWindow.castShadow=false;
  box([1.22,.08,1.3],paint,car,[0,1.968,-.12]);
  for(const side of [-1,1]){
    const window=box([.012,.36,1.22],glass,car,[side*.89,1.65,-.10]);
    window.castShadow=false;
    box([.08,.06,1.32],paint,car,[side*.89,1.49,-.10]);
    box([.27,.12,.29],blackCarbon,car,[side*1.065,1.44,.55]);
    box([.18,.17,.28],paint,car,[side*.90,1.37,1.82]);
    // Large oval headlights, black air exits and carbon aero inlets.
    const lamp=unit(new THREE.SphereGeometry(.195,18,14),headLamp,car,[side*.67,1.29,2.03]);
    lamp.scale.set(.77,.34,1.05);
    box([.25,.026,.62],blackCarbon,car,[side*.49,1.45,1.39],[-.12,side*.11,0]);
    const intake=box([.10,.31,.47],blackCarbon,car,[side*.94,.92,1.62]);
    intake.rotation.y=side*.16;
    // Fenders with red decals, while keeping the car visually original.
    box([.055,.065,1.34],blackCarbon,car,[side*.965,.97,-.65]);
    box([.058,.035,.98],redWheel,car,[side*.992,.985,-.80]);
    // Carbon side skirt and rear outlet.
    box([.13,.1,2.60],blackCarbon,car,[side*.90,.71,-.15]);
    box([.08,.13,.46],blackCarbon,car,[side*.96,1.18,-1.55]);
    const light=box([.39,.070,.05],redLamp,car,[side*.69,1.18,-2.25]);
    light.castShadow=false;
  }
  // High-mounted rear wing with slender uprights and deep carbon plane.
  rod([-.64,1.29,-1.87],[-.73,2.27,-2.13],.055,blackCarbon,car);
  rod([.64,1.29,-1.87],[.73,2.27,-2.13],.055,blackCarbon,car);
  box([2.12,.10,.50],blackCarbon,car,[0,2.33,-2.17],[-.14,0,0]);
  box([2.16,.11,.13],blackCarbon,car,[0,2.38,-2.37],[-.08,0,0]);
  for(const side of [-1,1]){
    box([.12,.17,.53],blackCarbon,car,[side*1.06,2.33,-2.17]);
  }
  box([1.75,.065,.18],blackCarbon,car,[0,1.26,-2.11]);
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
  const [x,y,z]=coords[wheel.id],side=wheel.side;
  const wheelShell=new THREE.Group();
  wheelShell.position.set(x,y,z);
  car.add(wheelShell);
  wheelVisuals.set(wheel.id,wheelShell);
  wheelCenters.set(wheel.id,new THREE.Vector3(x,y,z));
  const tire=tag(unit(new THREE.TorusGeometry(.465,.128,16,60),tireMaterial,wheelShell,[side*.065,0,0],[0,Math.PI/2,0]),'__wheel__',wheel.id);
  const rim=tag(cyl(.345,.345,.075,redWheel,wheelShell,[side*.114,0,0],[0,0,Math.PI/2]),'__wheel__',wheel.id);
  const inner=tag(cyl(.275,.275,.082,dark,wheelShell,[side*.178,0,0],[0,0,Math.PI/2]),'__wheel__',wheel.id);
  for(let j=0;j<11;j++){
    const a=j/11*Math.PI*2;
    tag(box([.04,.30,.042],redWheel,wheelShell,[side*.23,Math.cos(a)*.145,Math.sin(a)*.145],[a,0,0]),'__wheel__',wheel.id);
  }
  tag(cyl(.074,.074,.16,blackCarbon,wheelShell,[side*.27,0,0],[0,0,Math.PI/2]),'__wheel__',wheel.id);
  const assembly=new THREE.Group();
  assembly.position.set(x-side*.07,y,z);
  car.add(assembly);
  wheelParts.set(wheel.id,assembly);
  const elements={};
  const group=(name)=>{
    const node=new THREE.Group();
    node.userData.home=new THREE.Vector3();
    node.userData.target=new THREE.Vector3();
    assembly.add(node);elements[name]=node;
    return node;
  };
  const hub=group('moyeu');
  tag(cyl(.15,.15,.17,silver,hub,[side*.012,0,0],[0,0,Math.PI/2]),'disques',wheel.id);
  tag(cyl(.085,.085,.22,metal,hub,[side*.105,0,0],[0,0,Math.PI/2]),'disques',wheel.id);
  for(let i=0;i<5;i++){
    const a=i/5*Math.PI*2;
    tag(cyl(.022,.022,.12,boltMaterial,hub,[side*.16,Math.cos(a)*.112,Math.sin(a)*.112],[0,0,Math.PI/2]),'disques',wheel.id);
  }
  const rotor=group('disques');
  tag(cyl(.345,.345,.058,brakeMaterial,rotor,[side*.065,0,0],[0,0,Math.PI/2]),'disques',wheel.id);
  tag(unit(new THREE.TorusGeometry(.31,.015,9,56),silver,rotor,[side*.102,0,0],[0,Math.PI/2,0]),'disques',wheel.id);
  tag(unit(new THREE.TorusGeometry(.155,.012,8,48),dark,rotor,[side*.103,0,0],[0,Math.PI/2,0]),'disques',wheel.id);
  for(let i=0;i<20;i++){
    const a=i/20*Math.PI*2;
    tag(unit(new THREE.SphereGeometry(.011,8,6),dark,rotor,[side*.103,Math.cos(a)*.25,Math.sin(a)*.25]),'disques',wheel.id);
  }
  const caliper=group('etrier');
  tag(box([.20,.31,.21],amber,caliper,[side*.22,.075,-.245]),'plaquettes',wheel.id);
  tag(box([.245,.075,.25],blackCarbon,caliper,[side*.23,.24,-.24]),'plaquettes',wheel.id);
  tag(box([.21,.075,.25],blackCarbon,caliper,[side*.23,-.075,-.24]),'plaquettes',wheel.id);
  const pads=group('plaquettes');
  tag(box([.036,.22,.20],partMaterial('plaquettes'),pads,[side*.105,.055,-.225]),'plaquettes',wheel.id);
  tag(box([.036,.22,.20],partMaterial('plaquettes'),pads,[side*.015,.055,-.225]),'plaquettes',wheel.id);
  const hose=group('liquide');
  tag(rod([side*.15,.09,-.22],[side*.22,.44,-.31],.025,partMaterial('liquide'),hose),'liquide',wheel.id);
  if(wheel.front){
    const triangle=group('triangles');
    tag(rod([0,-.10,-.16],[-side*.43,-.32,-.42],.055,partMaterial('triangles'),triangle),'triangles',wheel.id);
    tag(rod([0,-.10,.20],[-side*.43,-.32,-.42],.055,partMaterial('triangles'),triangle),'triangles',wheel.id);
    tag(cyl(.09,.09,.08,metal,triangle,[-side*.43,-.32,-.42],[0,0,Math.PI/2]),'triangles',wheel.id);
    const steering=group('rotules');
    tag(rod([-side*.10,.05,0],[-side*.47,.10,.45],.04,partMaterial('rotules'),steering),'rotules',wheel.id);
    tag(unit(new THREE.SphereGeometry(.072,14,10),partMaterial('rotules'),steering,[-side*.47,.10,.45]),'rotules',wheel.id);
    const stabilizer=group('stabilisation');
    tag(rod([side*.01,.12,-.24],[-side*.29,.62,-.25],.04,partMaterial('stabilisation'),stabilizer),'stabilisation',wheel.id);
    tag(unit(new THREE.SphereGeometry(.064,14,10),partMaterial('stabilisation'),stabilizer,[-side*.29,.62,-.25]),'stabilisation',wheel.id);
  }
  wheelMechanics.set(wheel.id,elements);
  assembly.visible=false;
}
data.wheels.forEach(wheelAssembly);
const selectableParts=()=>{
  return interactables.filter(o=>o.userData.partId!=='__wheel__' && data.byId(o.userData.partId));
};
let currentWheel=null, currentPart=null, currentFamily='freinage', currentStep=0;
let cameraAnimation=null;
function focusOnWheel(id){
  const wheel=data.wheelById(id);
  if(!wheel)return;
  cameraAnimation={
    target:new THREE.Vector3(0,1.46,0),
    position:new THREE.Vector3(3.45,2.50,3.48)
  };
  controls.autoRotate=false;
}
function applyExploded(){
  workshopHD.nodes.get('roue').visible=Boolean(currentWheel);
  workshopHD.setState({family:currentFamily,step:currentStep,front:currentWheel ? data.wheelById(currentWheel).front : true});
  data.wheels.forEach(wheel=>{
    const selected=currentWheel===wheel.id;
    const visual=wheelVisuals.get(wheel.id);
    const component=wheelParts.get(wheel.id);
    component.visible=selected;
    const removed=selected&&currentStep>=1;
    visual.userData.targetX=removed?wheel.side*(1.2+Math.max(0,currentStep-2)*.18):0;
    const elements=wheelMechanics.get(wheel.id);
    for(const [name,node] of Object.entries(elements)){
      const target=node.userData.target;
      target.set(0,0,0);
      if(!selected)continue;
      const order=currentFamily==='freinage'
        ? ['etrier','plaquettes','disques','moyeu']
        : ['triangles','rotules','stabilisation'];
      const index=order.indexOf(name);
      if(index<0 || currentStep<index+2)continue;
      const exposure=currentStep-index-2;
      target.set(wheel.side*(.42+index*.16+exposure*.13),
        name==='etrier' ? 0.33 : name==='plaquettes' ? 0.10 : name==='triangles' ? -0.15 : 0,
        name==='plaquettes' ? -0.12 : name==='rotules' ? 0.08 : 0);
    }
  });
}
function updateStepPanel(){
  const panel=el('edm3dInspection');
  if(panel)panel.hidden=!currentWheel;
  const loading=el('edm3dModelSupport');
  if(loading&&currentWheel&&!gt3?.supports(currentWheel,'wheel'))loading.textContent='La roue sélectionnée n’est pas identifiée comme un objet indépendant dans ce modèle. Le démontage est désactivé.';
  if(!currentWheel)return;
  const steps=data.stepsForWheel(currentWheel,currentFamily);
  const max=steps.length;
  currentStep=Math.min(Math.max(currentStep,0),max);
  const selected=steps[currentStep-1];
  const message=el('edm3dStepLabel');
  if(message)message.textContent=selected
    ? currentStep+' / '+max+' · '+selected.label
    : '0 / '+max+' · Assemblage complet';
  const description=el('edm3dStepDescription');
  if(description)description.textContent=selected?.description
    || 'Choisissez « Démonter la pièce suivante » pour visualiser chaque élément.';
  const progress=el('edm3dStepProgress');
  if(progress)progress.style.width=(max?currentStep/max*100:0)+'%';
  const prev=el('edm3dPrevStep'),next=el('edm3dNextStep'),rebuild=el('edm3dRebuild');
  if(prev)prev.disabled=currentStep<=0;
  if(next)next.disabled=currentStep>=max;
  if(rebuild)rebuild.disabled=currentStep===0;
  const rear=data.wheelById(currentWheel)?.front===false;
  const liaison=el('edm3dFamilyLiaison');
  if(liaison)liaison.disabled=rear;
  el('edm3dFamilyFreinage')?.setAttribute('aria-pressed',String(currentFamily==='freinage'));
  liaison?.setAttribute('aria-pressed',String(currentFamily==='liaison'));
  if(selected){
    const part=data.byId(selected.id);
    if(part)setPart(part.id,false);
    else{
      currentPart=null;delete root.dataset.part;
      const title=el('edm3dPartTitle'),body=el('edm3dPartBody');
      if(title)title.textContent=selected.label;
      if(body)body.innerHTML='<p>'+escape(selected.description)+'</p><p>Simulation pédagogique uniquement : ne constitue pas une procédure de démontage réelle.</p>';
      partButtons?.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
    }
  }else{
    currentPart=null;delete root.dataset.part;
    const title=el('edm3dPartTitle'),body=el('edm3dPartBody');
    if(title)title.textContent='Assemblage complet';
    if(body)body.innerHTML='<p>Les éléments sont remontés virtuellement. Avancez dans les étapes pour examiner chaque pièce.</p>';
    partButtons?.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
  }
}
function setStep(value){
  if(!currentWheel)return;
  const steps=data.stepsForWheel(currentWheel,currentFamily);
  const previousStep=currentStep;
  currentStep=Math.max(0,Math.min(Math.trunc(Number(value)||0),steps.length));
  if(gt3?.ready){
    const targetStep=currentStep;
    const expected=data.stepsForWheel(currentWheel,currentFamily).slice(0,targetStep).map(item=>item.id);
    const wheelId=currentWheel;
    gt3.setSteps(wheelId,expected).then(result=>{
      if(wheelId!==currentWheel)return;
      if(!result.ok){
        currentStep=previousStep;
        updateStepPanel();
        return;
      }
      updateStepPanel();
    });
  }
  else{
    currentStep=previousStep;
    const support=el('edm3dModelSupport');
    if(support)support.textContent='Chargez d’abord le modèle GT3 RS pour explorer ses composants.';
  }
  updateStepPanel();
  const wheel=data.wheelById(currentWheel);
  const step=steps[currentStep-1];
  const prompt=el('edm3dWheelPrompt');
  if(prompt)prompt.textContent=step
    ? 'Roue '+wheel.label.toLowerCase()+' · '+step.label+' · étape '+currentStep+'/'+steps.length
    : 'Roue '+wheel.label.toLowerCase()+' · assemblage complet.';
  live(step?'Démontage virtuel : '+step.label+'.':'Assemblage remis en place.');
}
function setFamily(family){
  if(!currentWheel)return;
  if(family==='liaison' && !data.wheelById(currentWheel)?.front)return;
  if(!['freinage','liaison'].includes(family))return;
  currentFamily=family;
  currentStep=0;
  refreshPartMenu();
  setStep(1);
}
const chosenWheel=()=>data.wheelById(currentWheel);
const availableServices=()=>Array.isArray(window.EDMShowroomActiveServices)?window.EDMShowroomActiveServices:null;
const button=(label,slug)=>data.requestUrl(slug)?'<a class="edm3d-offer" href="'+escape(data.requestUrl(slug))+'">'+escape(label)+'<span aria-hidden="true">↗</span></a>':'';
function setPart(id,syncStep=true){
  const part=data.byId(id);
  if(!part)return;
  currentPart=id;
  root.dataset.part=id;
  if(syncStep&&currentWheel){
    const targetFamily=part.category==='Liaison au sol'?'liaison':'freinage';
    if(targetFamily!==currentFamily){
      currentFamily=targetFamily;
      currentStep=1;
      refreshPartMenu();
    }
    const steps=data.stepsForWheel(currentWheel,currentFamily);
    const stepIndex=steps.findIndex(item=>item.id===id);
    if(stepIndex>=0 && root.dataset.view==='mechanics'){
      currentStep=stepIndex+1;
      applyExploded();
      updateStepPanel();
    }
  }
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
    +(options.length?options.map(opt=>button(opt.label,opt.slug)).join(''):part.choices.length===0?'<p>Présentation pédagogique : cette prestation n’est pas actuellement proposée par EDM28.</p>':'<p>Référence à vérifier avec EDM28.</p>')+'</div>';
  partButtons?.querySelectorAll('button').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.part===id)));
  const relevantMeshes=selectableParts();
  relevantMeshes.forEach(mesh=>{
    const material=mesh.material;
    if(!material?.emissive)return;
    material.emissive.set(mesh.userData.partId===id ? part.color : '#090d12');
    material.emissiveIntensity=mesh.userData.partId===id ? .45 : .07;
  });
  live('Composant sélectionné : '+part.label+(wheel?' sur la roue '+wheel.label.toLowerCase():'')+'.');
}
function refreshPartMenu(){
  if(!partButtons)return;
  if(!currentWheel){
    partButtons.innerHTML='<p class="edm3d-empty">Sélectionnez une roue pour découvrir ses composants.</p>';
    return;
  }
  const parts=data.forWheel(currentWheel).filter(part=>
    currentFamily==='freinage' ? part.category==='Freinage' : part.category==='Liaison au sol'
  );
  partButtons.innerHTML=parts.map(part=>
    '<button type="button" data-part="'+escape(part.id)+'" class="edm3d-part-button" aria-pressed="'+String(currentPart===part.id)+'">'
    +'<span class="edm3d-part-dot" style="--dot:'+part.color+'"></span>'+escape(part.label)+'</button>'
  ).join('');
  partButtons.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>setPart(btn.dataset.part)));
}
function showWheel(id){
  const wheel=data.wheelById(id);
  if(!wheel)return;
  if(currentWheel===id){if(gt3?.ready)setStep(1);return;}
  gt3?.restore();
  currentWheel=id;currentPart=null;currentFamily='freinage';currentStep=0;
  root.dataset.wheel=id;
  const choice=el('edm3dWheelChoice');
  if(choice)choice.value=id;
  const reset=el('edm3dReset');
  if(reset)reset.disabled=false;
  refreshPartMenu();
  updateStepPanel();
  const support=el('edm3dModelSupport');
  if(!gt3?.ready){
    if(support)support.textContent='Cliquez sur « Afficher la GT3 RS en 3D » pour accéder aux pièces de la voiture.';
    live('Chargez d’abord la Porsche GT3 RS. Les pièces sont contrôlées dans son modèle original.');
    return;
  }
  if(!gt3.supports(id,'wheel')){
    if(support)support.textContent='Cette roue n’est pas une pièce indépendante identifiable dans le modèle. Aucune disparition fictive.';
    live('Démontage indisponible pour '+wheel.label.toLowerCase()+'.');
    return;
  }
  if(support)support.textContent='Roue reconnue dans la GT3 RS. Utilisez les étapes pour masquer les pièces réelles du modèle.';
  setStep(1);
}

function restore(){
  currentWheel=null;currentPart=null;currentFamily='freinage';currentStep=0;
  cameraAnimation={
    target:new THREE.Vector3(0,1.48,0),
    position:new THREE.Vector3(4.2,2.85,4.6)
  };
  delete root.dataset.part; delete root.dataset.wheel;
  if(el('edm3dInspection'))el('edm3dInspection').hidden=true;
  for(const wheel of data.wheels){
    const mesh=wheelVisuals.get(wheel.id);
    mesh.userData.targetX=0;
    wheelParts.get(wheel.id).visible=false;
  }
  gt3?.restore();
  workshopHD.nodes.get('roue').visible=false;
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
el('edm3dFamilyFreinage')?.addEventListener('click',()=>setFamily('freinage'));
el('edm3dFamilyLiaison')?.addEventListener('click',()=>setFamily('liaison'));
el('edm3dPrevStep')?.addEventListener('click',()=>setStep(currentStep-1));
el('edm3dNextStep')?.addEventListener('click',()=>setStep(currentStep+1));
el('edm3dRebuild')?.addEventListener('click',()=>setStep(0));
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
  const isShown=object=>{
    for(let node=object;node;node=node.parent)if(!node.visible)return false;
    return true;
  };
  const detailedHit=raycaster.intersectObjects(workshopHD.pickables,false).find(hit=>isShown(hit.object));
  if(detailedHit){
    const id=detailedHit.object.userData.partId;
    if(!currentWheel)showWheel('av-droite');
    if(id==='__wheel__'){setStep(1);return;}
    const sequence=data.stepsForWheel(currentWheel,currentFamily);
    const index=sequence.findIndex(item=>item.id===id);
    if(index>=0){setStep(index+1);return;}
    if(id==='etrier'){setStep(2);return;}
    if(id==='moyeu'){setStep(5);return;}
    if(data.byId(id))setPart(id);
    return;
  }
  const hits=raycaster.intersectObjects(interactables,false).filter(hit=>isShown(hit.object));
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
const referenceFrame=el('edm3dReferenceFrame');
const referenceIntro=el('edm3dReferenceIntro');
const referenceStatus=el('edm3dReferenceLoadStatus');
const showSupport=message=>{
  const target=el('edm3dModelSupport');
  if(target)target.textContent=message;
  live(message);
};
const gt3=createGt3Workshop({
  iframe:referenceFrame,
  onWarning:showSupport,
  onReady({available}){
    if(referenceIntro)referenceIntro.classList.add('is-loaded');
    const msg=available.length
      ? 'GT3 RS prête. Roues identifiables : '+available.map(id=>data.wheelById(id)?.label||id).join(', ')+'.'
      : 'GT3 RS prête à tourner. Le fichier ne fournit aucune roue séparée clairement identifiable : le démontage sur ce modèle reste indisponible.';
    if(referenceStatus)referenceStatus.textContent=msg;
    showSupport(msg);
    if(currentWheel)showWheel(currentWheel);
  },
  onClick({wheel,part}){
    if(!data.wheelById(wheel))return;
    if(currentWheel!==wheel)showWheel(wheel);
    if(part==='wheel'){if(gt3.supports(wheel,'wheel'))setStep(1);return;}
    const current=data.byId(part);
    if(current){setPart(current.id,false);return;}
    const labels={etrier:['Étrier de frein','L’étrier serre les plaquettes sur le disque pour ralentir la roue.'],moyeu:['Moyeu de roue','Le moyeu porte la roue et transmet sa rotation.']};
    const selected=labels[part];
    if(selected){
      const title=el('edm3dPartTitle'),body=el('edm3dPartBody');
      if(title)title.textContent=selected[0];
      if(body)body.textContent=selected[1];
    }
  }
});
el('edm3dLoadReference')?.addEventListener('click',()=>{
  if(referenceIntro)referenceIntro.classList.add('is-loading');
  if(referenceStatus)referenceStatus.textContent='Chargement du lecteur GT3 RS…';
  gt3.init().catch(error=>{
    referenceIntro?.classList.remove('is-loading');
    showSupport('Interaction avancée indisponible : '+error.message+'. La rotation 360° reste accessible.');
    const fallback=referenceFrame?.dataset.src;
    if(referenceFrame&&fallback?.startsWith('https://sketchfab.com/models/')){
      referenceFrame.addEventListener('load',()=>{
        referenceIntro?.classList.add('is-loaded');
      },{once:true});
      referenceFrame.src=fallback;
    }
  });
});
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
  if(root.dataset.view!=='mechanics'){frameId=requestAnimationFrame(draw);return;}
  const step=reduceMotion?1:.13;
  for(const wheel of data.wheels){
    const visual=wheelVisuals.get(wheel.id);
    const end=visual.userData.targetX||0;
    visual.position.x+= (coords[wheel.id][0]+end-visual.position.x)*step;
    const groups=wheelMechanics.get(wheel.id);
    for(const node of Object.values(groups))node.position.lerp(node.userData.target,step);
  }
  if(cameraAnimation){
    controls.target.lerp(cameraAnimation.target,Math.min(.18,step));
    camera.position.lerp(cameraAnimation.position,Math.min(.18,step));
    if(camera.position.distanceTo(cameraAnimation.position)<.014 && controls.target.distanceTo(cameraAnimation.target)<.014)cameraAnimation=null;
  }
  workshopHD.animate(step);
  controls.update();
  renderer.render(scene,camera);
  frameId=requestAnimationFrame(draw);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&running&&frameId===null)frameId=requestAnimationFrame(draw);});
const cleanup=()=>{
  observer.disconnect();resizer.disconnect();
  if(frameId!==null)cancelAnimationFrame(frameId);
  controls.dispose();workshopHD.dispose();studioMap.dispose();renderer.dispose();
  made.forEach(object=>object.geometry?.dispose());
  [...new Set(made.map(object=>object.material))].forEach(material=>material?.dispose?.());
};
window.addEventListener('pagehide',cleanup,{once:true});
restore();
root.classList.add('edm3d-ready');
live('Atelier 3D détaillé prêt. Sélectionnez une roue pour démonter les pièces.');
frameId=requestAnimationFrame(draw);
