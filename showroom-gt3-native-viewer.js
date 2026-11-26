/* EDM28 single-scene showroom using the supplied Porsche models. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGt3ImportedModel } from './showroom-gt3-imported-model.js?v=1';
const el=id=>document.getElementById(id);
const root=el('edm3dShowroom'),host=el('edm3dCanvas');
const data=window.EDMShowroomData;
if(!root||!host||!data)throw new Error('Showroom EDM28 incomplet : impossible de construire la scène.');
const status=el('edm3dStatus');
const live=text=>{if(status)status.textContent=text;};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderNeeded=true,frameId=null,running=true,disposed=false,drawReady=false,drawing=false,contextLost=false;
function scheduleFrame(){
  if(!drawReady||disposed||contextLost||!running||document.hidden||drawing||frameId!==null)return;
  frameId=requestAnimationFrame(draw);
}
const requestRender=()=>{renderNeeded=true;scheduleFrame();};
const pixelRatioFor=width=>Math.min(window.devicePixelRatio||1,width<=580?1.25:width<=1050?1.5:1.75);
root.addEventListener('click',requestRender);
root.addEventListener('change',requestRender);
const loadingControls=Array.from(root.querySelectorAll('button,select'),control=>({control,disabled:control.disabled}));
loadingControls.forEach(({control})=>{control.disabled=true;});
let renderer,pixelRatio=1;
try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  pixelRatio=pixelRatioFor(window.innerWidth);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.96;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.domElement.setAttribute('role','img');
  renderer.domElement.setAttribute('aria-label','Porsche 911 GT3 RS en 3D. Cliquez sur une roue pour explorer les pièces détaillées.');
  host.replaceChildren(renderer.domElement);
}catch(error){
  root.classList.add('edm3d-unavailable');
  live('La 3D est indisponible dans ce navigateur. Les fiches et les prestations restent accessibles via les liens ci-dessous.');
  throw error;
}
const scene=new THREE.Scene();
scene.background=new THREE.Color('#171e27');
scene.fog=new THREE.Fog('#171e27',17,29);
const camera=new THREE.PerspectiveCamera(36,1,.075,65);
camera.position.set(7.2,3.4,8.6);
const controls=new OrbitControls(camera,renderer.domElement);
controls.addEventListener('change',requestRender);
controls.target.set(0,.84,0);
controls.enableDamping=!reduceMotion;
controls.dampingFactor=.07;
controls.minDistance=1.9;
controls.maxDistance=17;
controls.maxPolarAngle=Math.PI*.485;
controls.autoRotate=false;
controls.autoRotateSpeed=.52;
controls.update();
scene.add(new THREE.HemisphereLight('#eef3fa','#252a33',.7));
const key=new THREE.DirectionalLight('#fff5e9',1.8);
key.position.set(-3.5,8,5);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left=-4.5;key.shadow.camera.right=4.5;key.shadow.camera.top=4.5;key.shadow.camera.bottom=-4.5;
key.shadow.camera.near=.5;key.shadow.camera.far=22;
key.shadow.normalBias=.018;key.shadow.bias=-.00005;
key.shadow.radius=3.5;
key.shadow.intensity=.76;
scene.add(key);
const fill=new THREE.DirectionalLight('#cadcf3',.85);
fill.position.set(6,3,4);scene.add(fill);
const back=new THREE.DirectionalLight('#edf4ff',1.45);
back.position.set(2,5,-6);scene.add(back);
const inspectionLight=new THREE.DirectionalLight('#f4f7ff',0);
scene.add(inspectionLight,inspectionLight.target);
const floorMaterial=new THREE.MeshStandardMaterial({color:'#17202a',metalness:.08,roughness:.76});
const floorGeo=new THREE.PlaneGeometry(55,55);
const floor=new THREE.Mesh(floorGeo,floorMaterial);
floor.rotation.x=-Math.PI/2;
floor.position.y=.125;
floor.receiveShadow=true;scene.add(floor);
const contactCanvas=document.createElement('canvas');
contactCanvas.width=contactCanvas.height=128;
const contactContext=contactCanvas.getContext('2d');
const contactGradient=contactContext.createRadialGradient(64,64,10,64,64,64);
contactGradient.addColorStop(0,'rgba(0,0,0,.62)');
contactGradient.addColorStop(.5,'rgba(0,0,0,.42)');
contactGradient.addColorStop(1,'rgba(0,0,0,0)');
contactContext.fillStyle=contactGradient;contactContext.fillRect(0,0,128,128);
const contactTexture=new THREE.CanvasTexture(contactCanvas);
const contactGeometry=new THREE.PlaneGeometry(3.35,5.7);
const contactMaterial=new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,toneMapped:false});
const contactShadow=new THREE.Mesh(contactGeometry,contactMaterial);
contactShadow.rotation.x=-Math.PI/2;contactShadow.position.set(0,.128,0);
scene.add(contactShadow);
let envTarget=null;
const environmentGeometries=[],environmentMaterials=[];
let pmrem=null;
try{
  const environment=new THREE.Scene();
  environment.background=new THREE.Color('#202630');
  const softbox=(position,target,w,h,color,intensity)=>{
    const material=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide,toneMapped:false});
    const geometry=new THREE.PlaneGeometry(w,h);
    const plane=new THREE.Mesh(geometry,material);
    plane.position.set(...position);plane.lookAt(...target);environment.add(plane);
    environmentGeometries.push(geometry);environmentMaterials.push(material);
  };
  softbox([-3,7,1],[0,0,0],2.4,7,'#fff5e9',4);
  softbox([5,2,0],[0,1,0],1.5,7,'#e2edff',2.7);
  softbox([-5,2,-2],[0,1,0],1.3,6,'#ffffff',2);
  softbox([0,5,-6],[0,0,0],7,1.5,'#e8f0ff',4.5);
  pmrem=new THREE.PMREMGenerator(renderer);
  envTarget=pmrem.fromScene(environment,.015);
  scene.environment=envTarget.texture;
  scene.environmentIntensity=.8;
}catch{
  scene.environment=null;
}finally{
  pmrem?.dispose();
  environmentGeometries.forEach(geometry=>geometry.dispose());
  environmentMaterials.forEach(material=>material.dispose());
}
const loading=document.createElement('div');
loading.className='edm3d-loading';loading.textContent='Chargement de la Porsche et de ses textures…';
host.appendChild(loading);
renderer.render(scene,camera);
let model,lastAnnouncedProgress=-1;
try{
  model=await createGt3ImportedModel(THREE,{onProgress:event=>{
    const percent=event.total>0?Math.min(100,Math.round(event.loaded/event.total*100)):null;
    loading.textContent='Chargement de la Porsche et de ses textures…'+(percent===null?'':' '+percent+' %');
    const bucket=percent===null?0:Math.floor(percent/25);
    if(bucket!==lastAnnouncedProgress){
      lastAnnouncedProgress=bucket;
      live(loading.textContent);
    }
  }});
}catch(error){
  root.classList.add('edm3d-unavailable');
  live('Le modèle 3D n’a pas pu être chargé. Rechargez la page pour réessayer ; les liens vers les prestations restent disponibles.');
  contactGeometry.dispose();contactMaterial.dispose();contactTexture.dispose();
  floorGeo.dispose();floorMaterial.dispose();
  controls.dispose();renderer.dispose();envTarget?.dispose();
  throw error;
}
loading.remove();
host.removeAttribute('aria-busy');
loadingControls.forEach(({control,disabled})=>{control.disabled=disabled;});
if(reduceMotion){
  const rotate=el('edm3dRotate');
  if(rotate){
    rotate.disabled=true;
    rotate.title='Rotation automatique désactivée par vos préférences de réduction des animations.';
  }
}
scene.add(model.root);
renderer.shadowMap.needsUpdate=true;
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
function updateWheelShortcuts(){
  root.querySelectorAll('[data-edm-wheel]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.edmWheel===chosenWheel));
  });
}
let cameraGoal=null;
let viewIsManual=false;
function markManualView(){
  cameraGoal=null;viewIsManual=true;
  const reset=el('edm3dReset');
  if(reset)reset.disabled=false;
  requestRender();
}
function stopRotation(){
  controls.autoRotate=false;
  const position=camera.position.clone(),target=controls.target.clone();
  const damping=controls.enableDamping;
  // Drain the previous gesture's inertia without moving the visible camera.
  controls.enableDamping=false;
  controls.update();
  camera.position.copy(position);controls.target.copy(target);
  controls.enableDamping=damping;
  controls.update();
  const rotate=el('edm3dRotate');
  if(rotate){rotate.setAttribute('aria-pressed','false');rotate.textContent='Rotation automatique';}
}
controls.addEventListener('start',markManualView);
function carView(){
  const target=model.bounds.getCenter(new THREE.Vector3());
  const direction=new THREE.Vector3(1,.42,1.2).normalize();
  const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize();
  const up=new THREE.Vector3().crossVectors(direction,right);
  const bounds=model.bounds.clone();
  const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
  let distance=6;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const offset=new THREE.Vector3(x,y,z).sub(target);
    const depth=offset.dot(direction);
    distance=Math.max(distance,depth+Math.abs(offset.dot(right))/(tangent*camera.aspect*.87),depth+Math.abs(offset.dot(up))/(tangent*.66));
  }
  return {target,position:target.clone().addScaledVector(direction,Math.min(distance,controls.maxDistance))};
}
function steps(){
  if(!chosenWheel)return [];
  return model.stepIds(chosenWheel,family).map(id=>{
    const original=data.disassembly[family].find(stage=>stage.id===id);
    if(id==='etrier')return {...original,description:'L’étrier détaillé est écarté du disque dans cette vue pédagogique. Les éléments qui ne sont pas séparés dans le fichier restent solidaires de leur ensemble.'};
    if(id==='roue'&&family==='liaison')return {...original,description:'La roue s’écarte pour dévoiler les organes de suspension du train sélectionné.'};
    return original;
  });
}
function focusWheel(id){
  const wheel=model.wheels.get(id);
  if(!wheel)return;
  viewIsManual=false;
  const target=model.focusCenter(id).add(new THREE.Vector3(wheel.side*.83,.10,wheel.front?-.05:.05));
  const offset=new THREE.Vector3(wheel.side*4.2,1.8,wheel.front?2.35:-2.35);
  offset.multiplyScalar(Math.max(1,1.05/camera.aspect));
  cameraGoal={
    target,
    position:target.clone().add(offset)
  };
  stopRotation();
  requestRender();
}
function focusAll(){
  stopRotation();
  viewIsManual=false;
  cameraGoal=carView();
  requestRender();
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
  const menu=order.filter(id=>partFor(id));
  const modeled=new Set(model.availableParts(chosenWheel));
  partButtons.innerHTML=menu.map(id=>{
    const part=partFor(id);
    if(!part)return '';
    return '<button type="button" data-part="'+escapeHtml(id)+'" class="edm3d-part-button" aria-pressed="'+String(selectedPart===id)+'">'+escapeHtml(part.label)+(modeled.has(id)?'':'<span class="edm3d-part-info-tag">Fiche</span>')+'</button>';
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
    const available=model.availableParts(chosenWheel).includes(id);
    body.innerHTML='<p class="edm3d-category">'+escapeHtml(part.category)+'</p>'
      +(!available?'<p class="edm3d-native-helper">Fiche explicative : cet élément n’est pas isolé dans le modèle 3D et ne possède pas d’étape de démontage.</p>':'')
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
  const liaison=el('edm3dFamilyLiaison');
  if(liaison)liaison.disabled=!model.stepIds(chosenWheel,'liaison').length;
  el('edm3dFamilyFreinage')?.setAttribute('aria-pressed',String(family==='freinage'));
  liaison?.setAttribute('aria-pressed',String(family==='liaison'));
}
function setStep(value){
  if(!chosenWheel)return;
  const list=steps();
  step=Math.max(0,Math.min(list.length,Math.trunc(Number(value)||0)));
  model.setDisassembly(chosenWheel,family,step);
  requestRender();
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
  updateWheelShortcuts();
  const reset=el('edm3dReset');
  if(reset)reset.disabled=false;
  model.setDisassembly(id,family,0);
  updatePartMenu();
  updateStepPanel();
  focusWheel(id);
  showPart('roue');
  const prompt=el('edm3dWheelPrompt');
  if(prompt)prompt.textContent=descriptor.label+' · choisissez « Démonter la pièce suivante » pour retirer la roue.';
  live(descriptor.label+' sélectionnée. Les commandes déplacent les pièces séparées de ce modèle.');
}
function showCar(){
  model.setDisassembly(null,'freinage',0);
  model.selectWheel(null);
  chosenWheel=null;step=0;selectedPart=null;family='freinage';
  const select=el('edm3dWheelChoice');
  if(select)select.value='';
  updateWheelShortcuts();
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
  if(!model.stepIds(chosenWheel,nextFamily).length)return;
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
  if(controls.autoRotate)markManualView();
  event.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));
  event.currentTarget.textContent=controls.autoRotate?'Arrêter la rotation':'Rotation automatique';
});
for(const [buttonId,factor] of [['edm3dZoomIn',.8],['edm3dZoomOut',1.25]]){
  el(buttonId)?.addEventListener('click',()=>{
    const vector=camera.position.clone().sub(controls.target).multiplyScalar(factor);
    const distance=vector.length();
    vector.setLength(Math.max(controls.minDistance,Math.min(controls.maxDistance,distance)));
    camera.position.copy(controls.target).add(vector);
    markManualView();controls.update();
  });
}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const activePointers=new Set();
const hasModifier=event=>event.altKey||event.ctrlKey||event.metaKey||event.shiftKey;
const plainPrimaryPointer=event=>event.isPrimary&&event.button===0&&!hasModifier(event);
let pressPoint=null;
renderer.domElement.addEventListener('pointerdown',event=>{
  activePointers.add(event.pointerId);
  pressPoint=activePointers.size===1&&plainPrimaryPointer(event)
    ? {pointerId:event.pointerId,x:event.clientX,y:event.clientY}:null;
},{capture:true});
renderer.domElement.addEventListener('pointermove',event=>{
  if(pressPoint?.pointerId!==event.pointerId)return;
  const moved=(event.getCoalescedEvents?.()||[]).concat(event)
    .some(point=>Math.hypot(point.clientX-pressPoint.x,point.clientY-pressPoint.y)>8);
  if(moved||event.buttons!==1||hasModifier(event))pressPoint=null;
},{capture:true});
const cancelPick=event=>{activePointers.delete(event.pointerId);pressPoint=null;};
renderer.domElement.addEventListener('pointercancel',cancelPick,{capture:true});
renderer.domElement.addEventListener('lostpointercapture',cancelPick);
// Handle the release before OrbitControls relinquishes pointer capture.
renderer.domElement.addEventListener('pointerup',event=>{
  const started=pressPoint;
  activePointers.delete(event.pointerId);
  pressPoint=null;
  if(!started||started.pointerId!==event.pointerId||activePointers.size||!plainPrimaryPointer(event))return;
  if(Math.hypot(event.clientX-started.x,event.clientY-started.y)>8)return;
  const rect=renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(model.raycastTargets,false);
  for(const hit of hits){
    if(!hit.object.visible)continue;
    let visible=true;
    for(let parent=hit.object.parent;parent;parent=parent.parent){if(!parent.visible){visible=false;break;}}
    if(!visible)continue;
    const picked=model.toDataPart(hit.object);
    if(!picked)return;
    if(chosenWheel!==picked.wheelId)selectWheel(picked.wheelId);
    showPart(picked.part);
    return;
  }
},{capture:true});
renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();
  contextLost=true;
  if(frameId!==null){cancelAnimationFrame(frameId);frameId=null;}
  controls.autoRotate=false;
  root.querySelectorAll('button,select').forEach(control=>{control.disabled=true;});
  root.classList.add('edm3d-unavailable');
  live('La scène a perdu le contexte WebGL. Les fiches restent consultables via les liens ci-dessous.');
});
renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
let firstSize=true;
const resize=()=>{
  const width=host.clientWidth||650,height=host.clientHeight||590;
  camera.aspect=width/height;camera.updateProjectionMatrix();
  const nextRatio=pixelRatioFor(window.innerWidth);
  if(nextRatio!==pixelRatio){pixelRatio=nextRatio;renderer.setPixelRatio(pixelRatio);}
  renderer.setSize(width,height,false);
  requestRender();
  if(firstSize){
    const frame=carView();
    controls.target.copy(frame.target);camera.position.copy(frame.position);controls.update();
    firstSize=false;
  }else if(!viewIsManual){
    if(chosenWheel)focusWheel(chosenWheel);else focusAll();
  }
};
const observer=new ResizeObserver(resize);
observer.observe(host);resize();
function draw(){
  frameId=null;
  if(disposed||contextLost||!running||document.hidden)return;
  drawing=true;
  let animationActive=false;
  try{
  const t=reduceMotion?1:.105;
  const modelChanged=model.animate(t);
  if(modelChanged)renderer.shadowMap.needsUpdate=true;
  const cameraMoving=cameraGoal!==null;
  if(cameraGoal){
    controls.target.lerp(cameraGoal.target,reduceMotion?1:.13);
    camera.position.lerp(cameraGoal.position,reduceMotion?1:.13);
    if(controls.target.distanceTo(cameraGoal.target)<.025&&camera.position.distanceTo(cameraGoal.position)<.025){
      controls.target.copy(cameraGoal.target);camera.position.copy(cameraGoal.position);
      cameraGoal=null;
    }
  }
  const controlsChanged=controls.update();
  inspectionLight.intensity=chosenWheel?1.3:0;
  if(chosenWheel){
    inspectionLight.position.copy(camera.position);
    inspectionLight.target.position.copy(controls.target);
  }
    animationActive=modelChanged||cameraMoving||controlsChanged||controls.autoRotate;
    if(renderNeeded||animationActive){
      renderer.render(scene,camera);
      renderNeeded=false;
    }
  }finally{
    drawing=false;
  }
  if(animationActive||renderNeeded)scheduleFrame();
}
const view=new IntersectionObserver(entries=>{
  running=entries.some(entry=>entry.isIntersecting);
  if(running)requestRender();
  if(!running&&frameId!==null){cancelAnimationFrame(frameId);frameId=null;}
},{threshold:.01});
view.observe(root);
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)requestRender();
  else if(frameId!==null){cancelAnimationFrame(frameId);frameId=null;}
});
window.addEventListener('pageshow',event=>{
  if(event.persisted&&!disposed)requestRender();
});
window.addEventListener('pagehide',event=>{
  if(event.persisted)return;
  if(disposed)return;
  disposed=true;
  if(frameId)cancelAnimationFrame(frameId);
  view.disconnect();observer.disconnect();
  controls.dispose();model.dispose();
  contactGeometry.dispose();contactMaterial.dispose();contactTexture.dispose();
  floorGeo.dispose();floorMaterial.dispose();envTarget?.dispose();renderer.dispose();
});
window.EDMShowroomSelectWheel=selectWheel;
renderer.render(scene,camera);
renderNeeded=false;
root.classList.add('edm3d-ready');
updatePartMenu();updateStepPanel();
drawReady=true;
requestRender();
live('Porsche chargée : quatre roues et leurs pièces mécaniques à explorer. Faites tourner la voiture ou choisissez une roue.');
