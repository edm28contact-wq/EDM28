/* EDM28 — GT3-inspired original parametric body + four independent workshop assemblies.
   All geometry is authored here and in showroom-workshop-hd.js; no third-party 3D asset.
   This educational representation is not manufacturer CAD or a repair procedure. */
import { createWorkshopHD } from './showroom-workshop-hd.js';
import { createGt3Body } from './showroom-gt3-native-body.js';
import { createGt3Wheel } from './showroom-gt3-native-wheels.js';
import { compactGt3Mechanics } from './showroom-gt3-native-mechanics.js';

export const GT3_WHEEL_POSITIONS=Object.freeze([
  {id:'av-gauche',side:-1,front:true,z:1.46},
  {id:'av-droite',side:1,front:true,z:1.46},
  {id:'ar-gauche',side:-1,front:false,z:-1.51},
  {id:'ar-droite',side:1,front:false,z:-1.51}
]);
export const GT3_REMOVAL_OFFSETS=Object.freeze({
  roue:[2.65,.08,1.60],
  etrier:[3.20,1.45,.30],
  plaquettes:[3.40,1.70,-1.10],
  disques:[3.35,0,-.85],
  moyeu:[3.00,-.13,-2.65],
  triangles:[4.00,0,-1.20],
  rotules:[3.80,.50,-2.60],
  stabilisation:[3.40,.40,-3.50],
  amortisseur:[3.20,.20,-1.20]
});
export function createGt3NativeModel(THREE) {
  const root=new THREE.Group();root.name='EDM28_GT3_Custom';
  const shell=createGt3Body(THREE),body=shell.root;root.add(body);
  const ownGeometries=[],ownMaterials=[],pickables=[],wheels=new Map();
  const material=(color,metalness=.12,roughness=.35,extras={})=>{
    const m=new THREE.MeshPhysicalMaterial({color,metalness,roughness,...extras});
    ownMaterials.push(m);return m;
  };
  const hd=createWorkshopHD(THREE);
  const compactMechanics=compactGt3Mechanics(THREE,hd);
  const strutMount=new THREE.Group();
  strutMount.scale.y=.86;strutMount.position.y=1.40*(1-.86);
  const strut=hd.nodes.get('amortisseur');
  strutMount.add(...strut.children);strut.add(strutMount);
  const detailedWheel=createGt3Wheel(THREE);
  const wheelTemplate=hd.nodes.get('roue');
  wheelTemplate.clear();wheelTemplate.add(...detailedWheel.root.children);
  const radiusScale=.41;
  const selectedRingGeo=new THREE.TorusGeometry(.54,.012,8,60);
  ownGeometries.push(selectedRingGeo);
  const haloMat=material('#a3dafa',.05,.38,{emissive:'#5daaf7',emissiveIntensity:1.3});
  const selectionHalos=new Map();
  for(const descriptor of GT3_WHEEL_POSITIONS){
    const instance=hd.root.clone(true);
    instance.name='ensemble_'+descriptor.id;
    instance.visible=true;
    instance.position.set(descriptor.side*(1.09-.34*radiusScale),.068,descriptor.z);
    instance.scale.set(descriptor.side*radiusScale,radiusScale,radiusScale);
    root.add(instance);
    const nodes=new Map();
    for(const node of instance.children){
      nodes.set(node.name,node);
      node.userData.target=new THREE.Vector3();
      node.position.set(0,0,0);
      if(!descriptor.front&&['triangles','rotules','stabilisation','amortisseur'].includes(node.name))node.visible=false;
    }
    instance.traverse(obj=>{
      if(!obj.isMesh)return;
      obj.castShadow=obj.userData.partId==='__wheel__';obj.receiveShadow=true;
      if(typeof obj.userData.partId!=='string')return;
      const part=obj.userData.partId==='__wheel__'?'roue':obj.userData.partId;
      if(part==='hydraulique')return;
      obj.userData.wheelId=descriptor.id;
      obj.userData.partId=part;
      pickables.push(obj);
    });
    const halo=new THREE.Mesh(selectedRingGeo,haloMat);
    halo.position.set(descriptor.side*1.25,.068+1.40*radiusScale,descriptor.z);
    halo.rotation.y=-Math.PI/2;
    halo.visible=false;
    root.add(halo);selectionHalos.set(descriptor.id,halo);
    wheels.set(descriptor.id,{...descriptor,instance,nodes});
  }
  function selectWheel(id){
    for(const [wheelId,ring] of selectionHalos)ring.visible=wheelId===id;
  }
  function setDisassembly(wheelId,family='freinage',step=0){
    const order=family==='liaison'
      ? ['roue','triangles','rotules','stabilisation','amortisseur']
      : ['roue','etrier','plaquettes','disques','moyeu'];
    const stage=Math.min(order.length,Math.max(0,Math.trunc(Number(step)||0)));
    for(const [id,unit] of wheels){
      const exposed=id===wheelId&&stage>0;
      for(const [name,node] of unit.nodes){
        const frontOnly=['triangles','rotules','stabilisation','amortisseur'].includes(name);
        node.visible=['roue','disques','etrier','plaquettes','moyeu'].includes(name)
          ||(exposed&&(name==='porte-fusee'||(family==='liaison'&&unit.front&&frontOnly)));
        node.userData.target.set(0,0,0);
        if(id!==wheelId||!Object.hasOwn(GT3_REMOVAL_OFFSETS,name))continue;
        const pos=order.indexOf(name);
        if(pos<0||stage<=pos)continue;
        const [x,y,z]=GT3_REMOVAL_OFFSETS[name];
        node.userData.target.set(x,y,z*(unit.front?1:-1));
      }
    }
    selectWheel(wheelId);
    return {wheelId,family,step:stage,order};
  }
  const toDataPart=mesh=>{
    const part=mesh?.userData?.partId,wheelId=mesh?.userData?.wheelId;
    return part&&wheelId?{wheelId,part}:null;
  };
  function animate(amount=.15){
    let changed=false;
    for(const unit of wheels.values()){
      for(const node of unit.nodes.values()){
        const target=node.userData.target;
        if(node.position.equals(target))continue;
        node.position.lerp(target,amount);
        if(node.position.distanceToSquared(target)<1e-8)node.position.copy(target);
        changed=true;
      }
    }
    return changed;
  }
  function focusCenter(id){
    const unit=wheels.get(id);
    return unit?new THREE.Vector3(unit.side*1.09,.70,unit.z):new THREE.Vector3(0,.88,0);
  }
  return {
    root,wheels,pickables,body,animate,setDisassembly,selectWheel,focusCenter,toDataPart,
    dispose(){
      for(const g of ownGeometries)g.dispose();
      for(const m of ownMaterials)m.dispose();
      root.traverse(object=>{if(object.isInstancedMesh)object.dispose();});
      shell.dispose();detailedWheel.dispose();compactMechanics.dispose();
      hd.dispose();
    }
  };
}
