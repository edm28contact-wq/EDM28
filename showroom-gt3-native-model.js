/* EDM28 — GT3-inspired original parametric body + four independent workshop assemblies.
   All geometry is authored here and in showroom-workshop-hd.js; no third-party 3D asset.
   This educational representation is not manufacturer CAD or a repair procedure. */
import { createWorkshopHD } from './showroom-workshop-hd.js';

export const GT3_WHEEL_POSITIONS=Object.freeze([
  {id:'av-gauche',side:-1,front:true,z:1.46},
  {id:'av-droite',side:1,front:true,z:1.46},
  {id:'ar-gauche',side:-1,front:false,z:-1.51},
  {id:'ar-droite',side:1,front:false,z:-1.51}
]);
export const GT3_REMOVAL_OFFSETS=Object.freeze({
  roue:[2.55,.08,.22],
  etrier:[1.18,.26,-.30],
  plaquettes:[1.75,.08,-.28],
  disques:[1.30,0,.06],
  moyeu:[1.05,-.13,.2],
  triangles:[-.95,-.24,-.38],
  rotules:[-1.15,.06,.5],
  stabilisation:[-.8,.30,-.28],
  amortisseur:[-.82,.37,.32]
});
const MATERIAL={paint:'#b9192d',shadow:'#870c1c',carbon:'#111a21',dark:'#202730',glass:'#192b3b',trim:'#3d4853',light:'#e5f2ff',led:'#ff324c',gold:'#bb9550'};
export function createGt3NativeModel(THREE) {
  const root=new THREE.Group();root.name='EDM28_GT3_Custom';
  const body=new THREE.Group();body.name='carrosserie';root.add(body);
  const ownGeometries=[],ownMaterials=[],pickables=[],wheels=new Map();
  const material=(color,metalness=.12,roughness=.35,extras={})=>{
    const m=new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:.33,clearcoatRoughness:.20,...extras});
    ownMaterials.push(m);return m;
  };
  const paint=material(MATERIAL.paint,.52,.27);
  const shadow=material(MATERIAL.shadow,.40,.32);
  const black=material(MATERIAL.carbon,.33,.48);
  const satin=material(MATERIAL.dark,.3,.47);
  const glass=material(MATERIAL.glass,.22,.16,{transparent:true,opacity:.90,side:THREE.DoubleSide});
  const line=material(MATERIAL.trim,.34,.42);
  const lamps=material(MATERIAL.light,.15,.12,{emissive:'#a5d2ec',emissiveIntensity:.65});
  const redLight=material(MATERIAL.led,.28,.2,{emissive:'#ec1b34',emissiveIntensity:.72});
  const wheelAccent=material(MATERIAL.gold,.63,.30);
  const add=(geo,mat,parent=body,pos=[0,0,0],rot=[0,0,0],scale=null)=>{
    ownGeometries.push(geo);
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(...pos);mesh.rotation.set(...rot);
    if(scale)mesh.scale.set(...scale);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
    return mesh;
  };
  const box=(size,mat,pos,rot=[0,0,0])=>
    add(new THREE.BoxGeometry(...size),mat,body,pos,rot);
  const sphere=(mat,pos,scale)=>
    add(new THREE.SphereGeometry(1,24,16),mat,body,pos,[0,0,0],scale);
  const tube=(points,r,mat)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve,Math.max(16,points.length*9),r,9,false),mat);
  };
  const polygon=(coords,x,mat,depth=.025)=>{
    const shape=new THREE.Shape();
    coords.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));
    shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:12});
    geo.rotateY(-Math.PI/2);
    return add(geo,mat,body,[x,0,0]);
  };
  // The lower perimeter rises over both wheel arches. The car body is not a
  // rectangular solid surrounding the tyres: the wheel wells remain open.
  const side=new THREE.Shape();
  side.moveTo(-2.62,.30);
  side.bezierCurveTo(-2.76,.47,-2.71,.88,-2.55,1.05);
  side.bezierCurveTo(-2.34,1.18,-1.77,1.29,-1.31,1.34);
  side.bezierCurveTo(-1.08,1.50,-.86,1.76,-.41,1.77);
  side.lineTo(.28,1.77);
  side.bezierCurveTo(.62,1.76,.77,1.45,.93,1.36);
  side.bezierCurveTo(1.33,1.36,2.07,1.32,2.40,1.16);
  side.bezierCurveTo(2.72,1.03,2.76,.72,2.67,.36);
  side.lineTo(2.27,.32);
  side.lineTo(2.23,.49);
  side.bezierCurveTo(2.06,.94,1.87,1.15,1.47,1.16);
  side.bezierCurveTo(1.06,1.15,.82,.93,.71,.47);
  side.lineTo(.66,.27);
  side.lineTo(-.78,.27);
  side.lineTo(-.82,.48);
  side.bezierCurveTo(-1.01,.94,-1.24,1.17,-1.55,1.17);
  side.bezierCurveTo(-1.96,1.16,-2.16,.92,-2.29,.48);
  side.lineTo(-2.36,.30);
  side.closePath();
  const shellGeo=new THREE.ExtrudeGeometry(side,{depth:2.04,steps:1,bevelEnabled:true,bevelThickness:.022,bevelSize:.018,bevelSegments:2,curveSegments:16});
  shellGeo.rotateY(-Math.PI/2);
  add(shellGeo,paint,body,[1.02,0,0]);
  // Flat sculpted center hood, roof and both flanks as independent decorative surfaces.
  polygon([[.78,1.38],[1.49,1.39],[2.46,1.16],[2.34,1.14],[1.52,1.28]],0,shadow,.005);
  for(const sideSign of [-1,1]){
    const outer=sideSign*1.052;
    // Black-tinted trapezoidal side windows with a clear painted A/C pillar.
    polygon([[.60,1.37],[.24,1.68],[-.32,1.69],[-.35,1.37]],sideSign>0?1.079:-1.087,glass,.012);
    polygon([[-.44,1.68],[-.83,1.63],[-1.18,1.36],[-.48,1.36]],sideSign>0?1.080:-1.087,glass,.012);
    tube([[outer,1.36,.60],[outer,1.70,.29],[outer,1.69,-.40],[outer,1.35,-1.16]],.022,black);
    tube([[outer,1.36,-.43],[outer,1.70,-.43]],.022,black);
    // Door seam and door handle.
    tube([[outer,1.32,.55],[outer,.47,.50],[outer,.41,-.55],[outer,1.29,-.60]],.009,shadow);
    box([.036,.045,.22],black,[sideSign*1.089,1.11,-.37]);
    // Side air intake behind the door, mirror and air guide.
    sphere(black,[sideSign*1.075,1.03,-1.14],[.027,.16,.31]);
    sphere(paint,[sideSign*1.23,1.38,.55],[.17,.07,.135]);
    tube([[sideSign*1.06,1.36,.67],[sideSign*1.22,1.37,.58]],.035,black);
    // Carbon side skirts, sculpted sill, rocker stripe.
    box([.145,.085,1.53],black,[sideSign*1.063,.30,.00]);
    box([.022,.032,1.29],shadow,[sideSign*1.079,.53,.04]);
    // Extended fender arch on both sides; incomplete arc follows wheel opening.
    for(const z of [1.46,-1.51]){
      const arc=new THREE.TorusGeometry(.675,.052,8,48,Math.PI);
      add(arc,paint,body,[sideSign*1.091,.62,z],[0,-Math.PI/2,0]);
      const inner=new THREE.TorusGeometry(.625,.022,7,48,Math.PI);
      add(inner,black,body,[sideSign*1.105,.62,z],[0,-Math.PI/2,0]);
    }
  }
  // Front and rear windscreens are sloped independent reflective panels.
  const quad=(points,mat)=>{
    const geom=new THREE.BufferGeometry();
    const vertices=[...points[0],...points[1],...points[2],...points[0],...points[2],...points[3]];
    geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geom.computeVertexNormals();
    return add(geom,mat);
  };
  quad([[-.88,1.36,.95],[.88,1.36,.95],[.82,1.70,.29],[-.82,1.70,.29]],glass);
  quad([[-.83,1.68,-.52],[.83,1.68,-.52],[.89,1.35,-1.24],[-.89,1.35,-1.24]],glass);
  const roof=box([1.65,.052,1.06],paint,[0,1.76,-.19]);
  roof.castShadow=true;
  // Rear-window roof intake, front vent blades, sculpted GT-style aero package.
  box([.43,.09,.27],black,[0,1.83,-.39]);
  for(const x of [-.74,.74]){
    sphere(black,[x,1.32,2.08],[.22,.035,.25]);
    sphere(lamps,[x,1.34,2.09],[.19,.023,.205]);
    box([.43,.055,.21],black,[x,.72,2.61]);
    box([.22,.020,.09],lamps,[x,.79,2.665]);
    box([.025,.15,.49],black,[x,.93,2.60]);
  }
  for(let i=-2;i<=2;i++){
    box([.075,.21,.10],black,[i*.27,.60,2.69]);
  }
  box([2.30,.085,.45],black,[0,.25,2.62]);
  box([2.18,.038,.14],shadow,[0,.35,2.67]);
  // Rear light bar, diffuser, twin exhaust outlets.
  box([2.05,.064,.054],redLight,[0,1.025,-2.64]);
  box([2.22,.23,.25],black,[0,.34,-2.62]);
  for(const x of [-.74,-.47,.47,.74])box([.041,.19,.33],line,[x,.31,-2.66]);
  for(const x of [-.26,.26]){
    add(new THREE.TorusGeometry(.099,.029,9,32),satin,body,[x,.43,-2.79],[0,0,0]);
  }
  // Raised double-stay carbon rear wing, placed entirely behind the cabin.
  for(const x of [-.63,.63]){
    tube([[x,1.09,-2.20],[x*.99,1.76,-2.34],[x,1.86,-2.38]],.052,black);
    box([.09,.09,.25],shadow,[x,1.11,-2.20]);
  }
  const wing=box([2.34,.105,.51],black,[0,1.88,-2.49],[.04,0,0]);
  wing.castShadow=true;
  box([2.34,.067,.08],shadow,[0,1.93,-2.72]);
  for(const x of [-1.13,1.13])box([.06,.17,.50],black,[x,1.89,-2.49]);
  // Chassis lower surfaces remain inside painted arch silhouette.
  box([1.64,.10,3.10],black,[0,.35,-.08]);
  box([1.86,.06,.55],black,[0,.35,-2.13]);
  // Tiny rear license panel and functional decorative screw dots.
  box([.54,.15,.025],satin,[0,.67,-2.77]);
  for(const x of [-.23,.23])sphere(line,[x,.67,-2.795],[.015,.015,.007]);
  // Interactive HD brake and suspension geometry, shared by all four wheels.
  const hd=createWorkshopHD(THREE);
  const radiusScale=.41;
  const selectedRingGeo=new THREE.TorusGeometry(.54,.012,8,60);
  ownGeometries.push(selectedRingGeo);
  const haloMat=material('#a3dafa',.05,.38,{emissive:'#5daaf7',emissiveIntensity:1.3});
  const selectionHalos=new Map();
  for(const descriptor of GT3_WHEEL_POSITIONS){
    const instance=hd.root.clone(true);
    instance.name='ensemble_'+descriptor.id;
    instance.visible=true;
    instance.position.set(descriptor.side*(1.14-.34*radiusScale),.068,descriptor.z);
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
      obj.castShadow=false;obj.receiveShadow=true;
      if(typeof obj.userData.partId!=='string')return;
      const part=obj.userData.partId==='__wheel__'?'roue':obj.userData.partId;
      if(part==='hydraulique')return;
      obj.userData.wheelId=descriptor.id;
      obj.userData.partId=part;
      pickables.push(obj);
    });
    const halo=new THREE.Mesh(selectedRingGeo,haloMat);
    halo.position.set(descriptor.side*1.26,.068+1.40*radiusScale,descriptor.z);
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
      for(const [name,node] of unit.nodes){
        node.userData.target.set(0,0,0);
        if(id!==wheelId||!Object.hasOwn(GT3_REMOVAL_OFFSETS,name))continue;
        const pos=order.indexOf(name);
        if(pos<0||stage<=pos)continue;
        const [x,y,z]=GT3_REMOVAL_OFFSETS[name];
        node.userData.target.set(x,y,z);
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
    for(const unit of wheels.values()){
      for(const node of unit.nodes.values())node.position.lerp(node.userData.target,amount);
    }
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
      hd.dispose();
    }
  };
}
