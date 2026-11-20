/* EDM28 original single-scene GT3 showroom: all visible model geometry is created locally. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGt3NativeModel } from './showroom-gt3-native-model.js';
const el=id=>document.getElementById(id);
const root=el('edm3dShowroom'),host=el('edm3dCanvas');
const data=window.EDMShowroomData;
if(!root||!host||!data)throw new Error('Showroom EDM28 incomplet : impossible de construire la scène.');
const status=el('edm3dStatus');
const live=text=>{if(status)status.textContent=text;};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('role','img');
  renderer.domElement.setAttribute('aria-label','GT3 3D originale entièrement démontable. Cliquez sur une roue pour explorer ses composants.');
  host.replaceChildren(renderer.domElement);
}catch(error){
  root.classList.add('edm3d-unavailable');
  live('Rendu 3D indisponible : '+error.message);
  throw error;
}
const scene=new THREE.Scene();
scene.background=new THREE.Color('#15202e');
const camera=new THREE.PerspectiveCamera(43,1,.075,80);
camera.position.set(6.55,3.42,6.90);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,.86,0);
controls.enableDamping=true;
controls.dampingFactor=.07;
controls.minDistance=1.9;
controls.maxDistance=17;
controls.maxPolarAngle=Math.PI*.51;
controls.autoRotate=false;
controls.autoRotateSpeed=.52;
controls.update();
scene.add(new THREE.HemisphereLight('#ffffff','#354152',2.05));
const key=new THREE.DirectionalLight('#fff6ee',3.2);
key.position.set(6,11,8);key.castShadow=true;
key.shadow.mapSize.set(1024,1024);
key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;
key.shadow.normalBias=.035;key.shadow.bias=-.0001;
scene.add(key);
const fill=new THREE.DirectionalLight('#add7ff',1.75);
fill.position.set(-6,4,-4);scene.add(fill);
const back=new THREE.DirectionalLight('#ffffff',1.25);
back.position.set(2,5,-7);scene.add(back);
const floorMaterial=new THREE.MeshStandardMaterial({color:'#2e3e50',metalness:.15,roughness:.72});
const floorGeo=new THREE.PlaneGeometry(55,55);
const floor=new THREE.Mesh(floorGeo,floorMaterial);
floor.rotation.x=-Math.PI/2;
floor.position.y=.13;
floor.receiveShadow=true;scene.add(floor);
let envTarget=null;
try{
  const environment=new THREE.Scene();
  environment.background=new THREE.Color('#778593');
  const white=new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide});
  const cool=new THREE.MeshBasicMaterial({color:'#c7e1ff',side:THREE.DoubleSide});
  const rect=(x,y,z,rotationY,w,h,material)=>{
    const geometry=new THREE.PlaneGeometry(w,h);
    const plane=new THREE.Mesh(geometry,material);
    plane.position.set(x,y,z);plane.rotation.y=rotationY;environment.add(plane);
    return geometry;
  };
  const envGeo=[
    rect(-6,6,2,Math.PI/5,7,5,white),
    rect(6,5,-3,-Math.PI/6,7,6,cool),
    rect(0,9,-4,0,10,3,white)
  ];
  const pmrem=new THREE.PMREMGenerator(renderer);
  envTarget=pmrem.fromScene(environment,.02);
  pmrem.dispose();
  scene.environment=envTarget.texture;
  envGeo.forEach(geometry=>geometry.dispose());
  white.dispose();cool.dispose();
}catch{
  scene.environment=null;
}
const model=createGt3NativeModel(THREE);
scene.add(model.root);
model.setDisassembly(null,'freinage',0);
const partButtons=el('edm3dParts');
const supplemental={
  roue:{
    id:'roue',label:'Roue et jante',category:'Roue',
    description:'La jante supporte le pneu et transmet les efforts de rotation au moyeu.',
    signs:['Vibration ou choc sur une jante','Dommage visible ou déformation','Perte de pression du pneu'],
    check:'Contrôler le pneu, la jante et les fixations selon les spécifications du véhicule.',
    replace:'Après constat d’un défaut. Respecter le serrage et les dimensions prévus par le constructeur.',choices:[]
  },
  etrier:{
    id:'etrier',label:'Étrier de frein',category:'Freinage',
    description:'Le corps d’étrier maintient les plaquettes et applique la force de freinage sur le disque.',
    signs:['Freinage déséquilibré','Usure irrégulière des plaquettes','Fuite ou grippage confirmé au contrôle'],
    check:'Contrôler les coulisseaux, pistons, joints et raccordements selon la conception du véhicule.',
    replace:'Seulement après diagnostic et conformément à la procédure du constructeur.',choices:[]
  },
  moyeu:{
    id:'moyeu',label:'Moyeu de roue',category:'Liaison au sol',
    description:'Le moyeu relie la roue au train roulant et supporte ses fixations et son roulement.',
    signs:['Bruit de roulement','Jeu confirmé lors d’un contrôle','Vibration ou échauffement anormal'],
    check:'Contrôler le roulement, le jeu et les points de fixation suivant la méthode du constructeur.',
    replace:'Après identification certaine du défaut.',choices:[]
  }
};
const partFor=id=>data.byId(id)||supplemental[id]||null;
let chosenWheel=null,family='freinage',step=0,selectedPart=null;
let cameraGoal=null;
function steps(){
  return chosenWheel?data.stepsForWheel(chosenWheel,family):[];
}
function focusWheel(id){
  const wheel=data.wheelById(id);
  if(!wheel)return;
  cameraGoal={
    target:model.focusCenter(id),
    position:new THREE.Vector3(wheel.side*3.3,2.00,wheel.front?wheel.side*.18+3.05:-.30).add(new THREE.Vector3(0,0,wheel.front?-.85:-1.35))
  };
  controls.autoRotate=false;
  const rotate=el('edm3dRotate');
  if(rotate){rotate.setAttribute('aria-pressed','false');rotate.textContent='Rotation automatique';}
}
function focusAll(){
  cameraGoal={target:new THREE.Vector3(0,.86,0),position:new THREE.Vector3(6.55,3.42,6.90)};
}
function updatePartMenu(){
  if(!partButtons)return;
  if(!chosenWheel){
    partButtons.innerHTML='<p class="edm3d-empty">Sélectionnez une roue pour découvrir les composants.</p>';
    return;
  }
  const order=family==='freinage'
    ? ['roue','etrier','plaquettes','disques','moyeu','liquide']
    : ['roue','triangles','rotules','stabilisation','amortisseur'];
  const menu=order.filter(id=>id==='roue'||data.forWheel(chosenWheel).some(part=>part.id===id)||id==='etrier'||id==='moyeu');
  partButtons.innerHTML=menu.map(id=>{
    const part=partFor(id);
    if(!part)return '';
    return '<button type="button" data-part="'+escapeHtml(id)+'" class="edm3d-part-button" aria-pressed="'+String(selectedPart===id)+'">'+escapeHtml(part.label)+'</button>';
  }).join('');
  partButtons.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>showPart(button.dataset.part)));
}
function showPart(id){
  const part=partFor(id);
  if(!part)return;
  selectedPart=id;
  const title=el('edm3dPartTitle'),body=el('edm3dPartBody');
  if(title)title.textContent=part.label;
  const offered=part.choices.filter(choice=>!Array.isArray(window.EDMShowroomActiveServices)||window.EDMShowroomActiveServices.includes(choice.slug));
  if(body){
    body.innerHTML='<p class="edm3d-category">'+escapeHtml(part.category)+'</p>'
      +'<p>'+escapeHtml(part.description)+'</p>'
      +'<h4>Signes à surveiller</h4><ul>'+part.signs.map(v=>'<li>'+escapeHtml(v)+'</li>').join('')+'</ul>'
      +'<h4>Quand contrôler ?</h4><p>'+escapeHtml(part.check)+'</p>'
      +'<h4>Quand remplacer ?</h4><p>'+escapeHtml(part.replace)+'</p>'
      +'<div class="edm3d-offers"><h4>Prestations EDM28</h4>'
      +(offered.length?offered.map(choice=>'<a class="edm3d-offer" href="'+escapeHtml(data.requestUrl(choice.slug))+'">'+escapeHtml(choice.label)+'</a>').join(''):'<p>Cette pièce est présentée à titre pédagogique. Vérifiez les prestations proposées dans le formulaire.</p>')+'</div>';
  }
  partButtons?.querySelectorAll('[data-part]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.part===id)));
  live(part.label+' : fiche affichée. Le démontage est commandé séparément.');
}
function updateStepPanel(){
  const list=steps(),count=list.length;
  const selected=list[step-1];
  const panel=el('edm3dInspection');
  if(panel)panel.hidden=!chosenWheel;
  const message=el('edm3dStepLabel');
  if(message)message.textContent=step+' / '+count+' · '+(selected?.label||'Assemblage complet');
  const description=el('edm3dStepDescription');
  if(description)description.textContent=selected?.description||'L’ensemble de freinage est en place. Utilisez les commandes pour le démonter.';
  const progress=el('edm3dStepProgress');
  if(progress)progress.style.width=(count?step/count*100:0)+'%';
  const previous=el('edm3dPrevStep'),next=el('edm3dNextStep'),rebuild=el('edm3dRebuild');
  if(previous)previous.disabled=step<=0;
  if(next)next.disabled=!chosenWheel||step>=count;
  if(rebuild)rebuild.disabled=step===0;
  const familyFront=data.wheelById(chosenWheel)?.front;
  const liaison=el('edm3dFamilyLiaison');
  if(liaison)liaison.disabled=!familyFront;
  el('edm3dFamilyFreinage')?.setAttribute('aria-pressed',String(family==='freinage'));
  liaison?.setAttribute('aria-pressed',String(family==='liaison'));
}
function setStep(value){
  if(!chosenWheel)return;
  const list=steps();
  step=Math.max(0,Math.min(list.length,Math.trunc(Number(value)||0)));
  model.setDisassembly(chosenWheel,family,step);
  updateStepPanel();
  const last=list[step-1];
  if(last)showPart(last.id);
  else if(selectedPart)showPart(selectedPart);
  const wheel=data.wheelById(chosenWheel);
  const prompt=el('edm3dWheelPrompt');
  if(prompt)prompt.textContent=step
    ? wheel.label+' · '+last.label+' · étape '+step+' sur '+list.length
    : wheel.label+' · tous les éléments sont remontés.';
  live(step?'Démontage virtuel : '+last.label+'.':'Ensemble mécanique remis en place.');
}
function selectWheel(id){
  const descriptor=data.wheelById(id);
  if(!descriptor)return;
  chosenWheel=id;family='freinage';step=0;selectedPart=null;
  const select=el('edm3dWheelChoice');
  if(select)select.value=id;
  const reset=el('edm3dReset');
  if(reset)reset.disabled=false;
  model.setDisassembly(id,family,0);
  updatePartMenu();
  updateStepPanel();
  focusWheel(id);
  showPart('roue');
  const prompt=el('edm3dWheelPrompt');
  if(prompt)prompt.textContent=descriptor.label+' · choisissez « Démonter la pièce suivante » pour retirer la roue.';
  live(descriptor.label+' sélectionnée. Les pièces sont indépendantes et démontables sur cette GT3.');
}
function showCar(){
  model.setDisassembly(null,'freinage',0);
  model.selectWheel(null);
  chosenWheel=null;step=0;selectedPart=null;family='freinage';
  const select=el('edm3dWheelChoice');
  if(select)select.value='';
  const reset=el('edm3dReset');
  if(reset)reset.disabled=true;
  const title=el('edm3dPartTitle'),body=el('edm3dPartBody');
  if(title)title.textContent='Choisissez une roue';
  if(body)body.innerHTML='<p>Sélectionnez une roue et cliquez sur ses composants pour consulter leurs fiches.</p>';
  const prompt=el('edm3dWheelPrompt');
  if(prompt)prompt.textContent='GT3 complète. Choisissez une roue pour démonter les éléments du train roulant.';
  updatePartMenu();updateStepPanel();focusAll();live('La GT3 est entièrement remontée.');
}
function setFamily(nextFamily){
  if(!chosenWheel||!['freinage','liaison'].includes(nextFamily))return;
  if(nextFamily==='liaison'&&!data.wheelById(chosenWheel)?.front)return;
  family=nextFamily;step=0;selectedPart=null;
  model.setDisassembly(chosenWheel,family,0);
  updatePartMenu();updateStepPanel();
  showPart('roue');
  live('Mode '+(family==='freinage'?'freinage':'liaison au sol')+' sélectionné.');
}
el('edm3dWheelChoice')?.addEventListener('change',event=>event.target.value?selectWheel(event.target.value):showCar());
root.querySelectorAll('[data-edm-wheel]').forEach(button=>button.addEventListener('click',()=>selectWheel(button.dataset.edmWheel)));
el('edm3dFamilyFreinage')?.addEventListener('click',()=>setFamily('freinage'));
el('edm3dFamilyLiaison')?.addEventListener('click',()=>setFamily('liaison'));
el('edm3dPrevStep')?.addEventListener('click',()=>setStep(step-1));
el('edm3dNextStep')?.addEventListener('click',()=>setStep(step+1));
el('edm3dRebuild')?.addEventListener('click',()=>setStep(0));
el('edm3dReset')?.addEventListener('click',showCar);
el('edm3dRotate')?.addEventListener('click',event=>{
  controls.autoRotate=!controls.autoRotate&&!reduceMotion;
  event.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));
  event.currentTarget.textContent=controls.autoRotate?'Arrêter la rotation':'Rotation automatique';
});
for(const [buttonId,factor] of [['edm3dZoomIn',.8],['edm3dZoomOut',1.25]]){
  el(buttonId)?.addEventListener('click',()=>{
    const vector=camera.position.clone().sub(controls.target).multiplyScalar(factor);
    const distance=vector.length();
    vector.setLength(Math.max(controls.minDistance,Math.min(controls.maxDistance,distance)));
    camera.position.copy(controls.target).add(vector);
    cameraGoal=null;controls.update();
  });
}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let pressPoint=null;
renderer.domElement.addEventListener('pointerdown',event=>{pressPoint={x:event.clientX,y:event.clientY};});
renderer.domElement.addEventListener('pointerup',event=>{
  if(!pressPoint)return;
  const distance=Math.hypot(event.clientX-pressPoint.x,event.clientY-pressPoint.y);
  pressPoint=null;
  if(distance>8)return;
  const rect=renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(model.pickables,false);
  for(const hit of hits){
    if(!hit.object.visible)continue;
    let visible=true;
    for(let parent=hit.object.parent;parent;parent=parent.parent){if(!parent.visible){visible=false;break;}}
    if(!visible)continue;
    const picked=model.toDataPart(hit.object);
    if(!picked)continue;
    if(chosenWheel!==picked.wheelId)selectWheel(picked.wheelId);
    showPart(picked.part);
    return;
  }
});
renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();root.classList.add('edm3d-unavailable');
  live('La scène a perdu le contexte WebGL. Les fiches restent consultables.');
});
renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
const resize=()=>{
  const width=host.clientWidth||650,height=host.clientHeight||590;
  camera.aspect=width/height;camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
};
const observer=new ResizeObserver(resize);
observer.observe(host);resize();
let running=true,frameId=null,disposed=false;
function draw(){
  frameId=null;
  if(disposed||!running||document.hidden)return;
  const t=reduceMotion?1:.105;
  model.animate(t);
  if(cameraGoal){
    controls.target.lerp(cameraGoal.target,reduceMotion?1:.13);
    camera.position.lerp(cameraGoal.position,reduceMotion?1:.13);
    if(controls.target.distanceTo(cameraGoal.target)<.025&&camera.position.distanceTo(cameraGoal.position)<.025)cameraGoal=null;
  }
  controls.update();
  renderer.render(scene,camera);
  frameId=requestAnimationFrame(draw);
}
const view=new IntersectionObserver(entries=>{
  running=entries.some(entry=>entry.isIntersecting);
  if(running&&!frameId)frameId=requestAnimationFrame(draw);
  if(!running&&frameId){cancelAnimationFrame(frameId);frameId=null;}
},{threshold:.01});
view.observe(root);
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&running&&!frameId)frameId=requestAnimationFrame(draw);
});
window.addEventListener('pagehide',()=>{
  if(disposed)return;
  disposed=true;
  if(frameId)cancelAnimationFrame(frameId);
  view.disconnect();observer.disconnect();
  controls.dispose();model.dispose();
  floorGeo.dispose();floorMaterial.dispose();envTarget?.dispose();renderer.dispose();
},{once:true});
window.EDMShowroomSelectWheel=selectWheel;
root.classList.add('edm3d-ready');
updatePartMenu();updateStepPanel();
if(!frameId)frameId=requestAnimationFrame(draw);
live('GT3 originale chargée : 4 roues et leurs composants démontables. Faites tourner la voiture ou choisissez une roue.');
