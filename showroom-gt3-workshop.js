/* Sketchfab vehicle workshop adapter. No access to geometry outside the public Viewer API.
   Changes to the 3D scene are permitted ONLY for independently identified model nodes. */
const MODEL_UID='5fd62615f72a4012a5ebc15cd4c64461';
const WHEELS=['av-gauche','av-droite','ar-gauche','ar-droite'];
const patterns={
  roue:/\b(wheel|wheels|roue|roues|tyre|tire|pneu|rim|jante|rims)\b/i,
  etrier:/\b(caliper|etrier|étrier)\b/i,
  plaquettes:/\b(pad|pads|plaquette|plaquettes)\b/i,
  disques:/\b(brake disc|brake disk|brake rotor|rotor|disque)\b/i,
  moyeu:/\b(hub|moyeu)\b/i,
  triangles:/\b(control arm|wishbone|triangle|lower arm)\b/i,
  rotules:/\b(tie rod|ball joint|rotule|biellette de direction)\b/i,
  stabilisation:/\b(stabilizer|stabiliser|sway bar|antiroll|barre stabilisatrice)\b/i,
  amortisseur:/\b(strut|shock absorber|coilover|amortisseur)\b/i,
  liquide:/\b(brake hose|brake line|brake fluid|flexible)\b/i
};
function clean(text){
  return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_\-.]+/g,' ').trim().toLowerCase();
}
function axle(name){
  const n=' '+clean(name)+' ';
  const front=/\b(front|avant|av|fwd|fr|fl|lf|rf)\b/.test(n);
  const rear=/\b(rear|arriere|ar|back|rr|rl|lr)\b/.test(n);
  if(front===rear)return null;
  return front?'av':'ar';
}
function side(name){
  const n=' '+clean(name)+' ';
  const left=/\b(left|gauche|lh|fl|lf|rl|lr)\b/.test(n);
  const right=/\b(right|droite|rh|fr|rf|rr)\b/.test(n);
  if(left===right)return null;
  return left?'gauche':'droite';
}
export function classifyNodeName(name){
  const n=clean(name),a=axle(n),s=side(n);
  if(!a||!s)return null;
  const part=Object.entries(patterns).find(([,pattern])=>pattern.test(n))?.[0];
  if(!part)return null;
  return {wheel:a+'-'+s,part};
}
export function mapModelNodes(raw){
  const entries=Array.isArray(raw)?raw:Object.values(raw||{});
  const result=new Map(),names=new Map(),allNodes=new Map();
  for(const id of WHEELS)result.set(id,new Map());
  for(const node of entries){
    if(!node || !Number.isInteger(node.instanceID) || typeof node.name!=='string')continue;
    allNodes.set(node.instanceID,{name:node.name,type:node.type});
    const matched=classifyNodeName(node.name);
    if(!matched)continue;
    const byPart=result.get(matched.wheel);
    const ids=byPart.get(matched.part)||[];
    ids.push(node.instanceID);byPart.set(matched.part,ids);
    names.set(node.instanceID,{...matched,name:node.name});
  }
  // Wheels must explicitly identify their exact axle AND side. Unnamed mesh families are unsafe to hide.
  return {wheels:result,names,allNodes,available:WHEELS.filter(w=>result.get(w).has('roue'))};
}
function scriptOnce(){
  if(window.Sketchfab)return Promise.resolve();
  if(window.__edmSketchfabScript)return window.__edmSketchfabScript;
  window.__edmSketchfabScript=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js';
    script.async=true;
    script.onload=()=>window.Sketchfab?resolve():reject(new Error('API Sketchfab non initialisée'));
    script.onerror=()=>reject(new Error('Chargement de l’API Sketchfab impossible'));
    document.head.appendChild(script);
  }).catch(error=>{window.__edmSketchfabScript=null;throw error;});
  return window.__edmSketchfabScript;
}
function invoke(api,method,id){
  return new Promise((resolve,reject)=>{
    api[method](id,error=>error?reject(new Error(String(error))):resolve());
  });
}
export function createGt3Workshop({iframe,onReady,onWarning,onClick,onCandidate}){
  let api=null,mapping=null,ready=false,initPromise=null,hidden=new Set(),queue=Promise.resolve();
  let pendingPick=null,candidate=null;
  const supports=(wheel,part)=>Boolean(mapping?.wheels.get(wheel)?.get(part)?.length);
  const nodesFor=(wheel,part)=>mapping?.wheels.get(wheel)?.get(part)||[];
  async function init(){
    if(initPromise)return initPromise;
    initPromise=(async()=>{
      await scriptOnce();
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Le lecteur 3D n’a pas répondu dans le délai imparti')),25000);
        const done=value=>{clearTimeout(timer);resolve(value);};
        const fail=error=>{clearTimeout(timer);reject(error);};
        const client=new window.Sketchfab('1.12.1',iframe);
        client.init(MODEL_UID,{
          autostart:1,preload:1,ui_hint:2,ui_theme:'dark',
          success(handle){
            api=handle;
            handle.addEventListener('viewerready',()=>{
              handle.getNodeMap((error,nodes)=>{
                if(error){fail(new Error('Lecture de la structure du modèle impossible'));return;}
                mapping=mapModelNodes(nodes);ready=true;
                handle.addEventListener('click',event=>{
                  const id=event?.instanceID??event?.node?.instanceID;
                  if(pendingPick){
                    const info=mapping?.allNodes.get(id);
                    if(!info){onWarning?.('Objet 3D non identifiable. Cliquez directement sur la pièce visible.');return;}
                    if(/^(root|scene|car|chassis|body|vehicle)(?:[_\s.-]|$)/i.test(info.name)){
                      onWarning?.('Ce groupe semble contenir la carrosserie : sélection refusée pour éviter de masquer toute la GT3 RS.');return;
                    }
                    candidate={...pendingPick,id,name:info.name};
                    pendingPick=null;
                    onCandidate?.({...candidate});
                    return;
                  }
                  const selected=mapping?.names.get(id);
                  if(selected)onClick?.(selected);
                },{pick:'slow'});
                onReady?.({available:mapping.available,capabilities:Object.fromEntries(WHEELS.map(w=>[w,Array.from(mapping.wheels.get(w).keys())]))});
                done(mapping);
              });
            });
          },
          error:()=>fail(new Error('Initialisation du lecteur 3D impossible'))
        });
      });
    })().catch(error=>{initPromise=null;onWarning?.(error.message);throw error;});
    return initPromise;
  }
  function beginPick(wheel,part='roue'){
    if(!ready || !WHEELS.includes(wheel) || (part!=='roue'&&!Object.hasOwn(patterns,part))){
      onWarning?.('Sélectionnez une roue valide et chargez la GT3 RS avant d’identifier une pièce.');
      return false;
    }
    pendingPick={wheel,part};
    candidate=null;
    return true;
  }
  function confirmPick(){
    if(!candidate||!mapping)return {ok:false,reason:'Aucune pièce choisie dans la GT3 RS'};
    const {wheel,part,id,name}=candidate;
    if(!mapping.allNodes.has(id))return {ok:false,reason:'Objet 3D inconnu'};
    const nodeMap=mapping.wheels.get(wheel);
    nodeMap.set(part,[id]);
    mapping.names.set(id,{wheel,part,name});
    candidate=null;pendingPick=null;
    return {ok:true,wheel,part,name};
  }
  function cancelPick(){pendingPick=null;candidate=null;}
  function setSteps(wheel,parts){
    queue=queue.catch(()=>{}).then(async()=>{
      if(!ready||!WHEELS.includes(wheel))return {ok:false,reason:'Le modèle 3D n’est pas prêt'};
      const desired=new Set();
      const missing=[];
      for(const part of parts){
        const ids=nodesFor(wheel,part);
        if(!ids.length){missing.push(part);break;}
        ids.forEach(id=>desired.add(id));
      }
      if(missing.length){
        onWarning?.('Cette pièce n’est pas séparée dans le modèle 3D : '+missing[0]+'. Aucun démontage artificiel effectué.');
        return {ok:false,missing};
      }
      try{
        for(const id of hidden)if(!desired.has(id))await invoke(api,'show',id);
        hidden=new Set([...hidden].filter(id=>desired.has(id)));
        for(const id of desired)if(!hidden.has(id)){await invoke(api,'hide',id);hidden.add(id);}
        return {ok:true};
      }catch(error){
        onWarning?.('La modification du modèle a échoué : '+error.message);
        return {ok:false,reason:error.message};
      }
    });
    return queue;
  }
  function restore(){
    queue=queue.catch(()=>{}).then(async()=>{
      if(!api)return;
      for(const id of hidden)await invoke(api,'show',id);
      hidden.clear();
    }).catch(error=>onWarning?.('Restauration impossible : '+error.message));
    return queue;
  }
  return {init,restore,setSteps,supports,beginPick,confirmPick,cancelPick,get ready(){return ready;},get modelUid(){return MODEL_UID;}};
}
