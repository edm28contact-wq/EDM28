import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export const IMPORTED_PART_ORDER=Object.freeze({
  freinage:Object.freeze(['roue','etrier','plaquettes','disques','moyeu']),
  liaison:Object.freeze(['roue','triangles','rotules','stabilisation','amortisseur'])
});
const wheelIds=['av-gauche','av-droite','ar-gauche','ar-droite'];
const offsets={
  roue:[1.05,.05,.65],etrier:[1.30,.75,.10],plaquettes:[1.40,.90,-.35],
  disques:[1.45,.18,-.60],moyeu:[1.30,.12,-1.20],triangles:[1.25,.10,-.50],
  rotules:[1.20,.48,-.95],stabilisation:[1.00,.60,-1.25],amortisseur:[1.30,.25,-.40]
};

function disposeObject(root){
  const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set();
  root.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    for(const material of [].concat(object.material||[]))materials.add(material);
  });
  for(const material of materials){
    for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    material.dispose();
  }
  for(const texture of textures){
    for(const source of [].concat(texture.source?.data||[]))if(source?.close)images.add(source);
    texture.dispose();
  }
  for(const image of images)image.close();
  for(const geometry of geometries)geometry.dispose();
}

export async function createGt3ImportedModel(THREE,{onProgress}={}){
  const decoder=new DRACOLoader();
  decoder.setDecoderPath('/assets/vendor/draco/');
  decoder.setDecoderConfig({type:'wasm'});
  decoder.setWorkerLimit(2);
  const loader=new GLTFLoader().setDRACOLoader(decoder);
  let loaded;
  try{
    loaded=await loader.loadAsync('/assets/models/edm28-gt3-hybrid-v1.glb',onProgress);
  }finally{
    decoder.dispose();
  }
  const root=loaded.scene;
  root.name='EDM28_GT3_Hybrid';
  root.updateMatrixWorld(true);
  const wheels=new Map(wheelIds.map(id=>[id,{id,front:id.startsWith('av-'),nodes:new Map()}]));
  const pickables=[],raycastTargets=[],rest=new Map(),halos=new Map();
  try{
    root.traverse(object=>{
      const {wheelId,partId}=object.userData;
      let nestedPart=false;
      for(let parent=object.parent;parent;parent=parent.parent){
        if(parent.userData.wheelId===wheelId&&parent.userData.partId===partId){nestedPart=true;break;}
      }
      if(wheels.has(wheelId)&&Object.hasOwn(offsets,partId)&&!nestedPart){
        const nodes=wheels.get(wheelId).nodes;
        if(nodes.has(partId))throw new Error('Pièce 3D dupliquée : '+wheelId+'/'+partId);
        nodes.set(partId,object);
      }
      if(object.isMesh){
        object.castShadow=true;object.receiveShadow=true;
        raycastTargets.push(object);
      }
    });
    const bounds=new THREE.Box3().setFromObject(root);
    for(const [id,wheel] of wheels){
      if(!wheel.nodes.has('roue'))throw new Error('Roue absente du fichier 3D : '+id);
      const wheelBounds=new THREE.Box3().setFromObject(wheel.nodes.get('roue'));
      const size=wheelBounds.getSize(new THREE.Vector3());
      wheel.center=wheelBounds.getCenter(new THREE.Vector3());
      wheel.side=Math.sign(wheel.center.x);
      wheel.radius=Math.max(size.y,size.z)*.5;
      if(!wheel.side||!Number.isFinite(wheel.radius)||wheel.radius<.15||wheel.radius>.65)
        throw new Error('Dimensions de roue incohérentes : '+id);
      for(const [part,node] of wheel.nodes){
        let meshes=0;
        node.traverse(mesh=>{
          if(!mesh.isMesh)return;
          meshes++;
          mesh.userData.wheelId=id;mesh.userData.partId=part;
          pickables.push(mesh);
        });
        if(!meshes)throw new Error('Pièce 3D vide : '+id+'/'+part);
        const position=node.position.clone();
        const offset=new THREE.Vector3(...offsets[part]);
        offset.x*=wheel.side;offset.z*=wheel.front?1:-1;
        offset.multiplyScalar(wheel.radius/.35);
        const removed=node.parent.worldToLocal(node.getWorldPosition(new THREE.Vector3()).add(offset));
        rest.set(node,{position,target:position.clone(),removed});
      }
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(wheel.radius*1.06,.007,6,72),
        new THREE.MeshBasicMaterial({color:'#a6d7ff',transparent:true,opacity:.75,depthWrite:false})
      );
      ring.name='wheel-selection-halo';
      ring.position.copy(wheel.center);
      ring.position.x=wheel.side>0?wheelBounds.max.x+.014:wheelBounds.min.x-.014;
      ring.rotation.y=Math.PI/2;
      ring.visible=false;root.add(ring);halos.set(id,ring);
    }
    const availableParts=id=>Array.from(wheels.get(id)?.nodes.keys()||[]);
    const stepIds=(id,family='freinage')=>{
      const wheel=wheels.get(id),order=IMPORTED_PART_ORDER[family];
      if(!wheel||!order)return [];
      const parts=order.filter(part=>wheel.nodes.has(part));
      return parts.length>1?parts:[];
    };
    function selectWheel(id){
      for(const [wheelId,halo] of halos)halo.visible=wheelId===id;
    }
    function setDisassembly(id,family='freinage',step=0){
      const order=stepIds(id,family);
      const stage=Math.max(0,Math.min(order.length,Math.trunc(Number(step)||0)));
      for(const [wheelId,wheel] of wheels){
        for(const [part,node] of wheel.nodes){
          const state=rest.get(node),index=order.indexOf(part);
          const removed=wheelId===id&&index>=0&&index<stage;
          state.target.copy(removed?state.removed:state.position);
        }
      }
      selectWheel(id);
      return {wheelId:id,family,step:stage,order};
    }
    function animate(amount=.15){
      let changed=false;
      for(const [node,state] of rest){
        if(node.position.equals(state.target))continue;
        node.position.lerp(state.target,amount);
        if(node.position.distanceToSquared(state.target)<1e-8)node.position.copy(state.target);
        changed=true;
      }
      return changed;
    }
    function focusCenter(id){
      return wheels.get(id)?.center.clone()||bounds.getCenter(new THREE.Vector3());
    }
    function toDataPart(mesh){
      const {wheelId,partId}=mesh?.userData||{};
      return wheels.get(wheelId)?.nodes.has(partId)?{wheelId,part:partId}:null;
    }
    return {
      root,body:root,bounds,wheels,pickables,raycastTargets,availableParts,stepIds,
      animate,setDisassembly,selectWheel,focusCenter,toDataPart,
      dispose(){disposeObject(root);}
    };
  }catch(error){
    disposeObject(root);
    throw error;
  }
}
