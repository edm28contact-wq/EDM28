/* EDM28 high-detail, independent educational brake/suspension assembly.
   Separate Three.js meshes; not Porsche or manufacturer CAD. Units: metres.
   The reference GT3 RS viewer remains separate from this mechanical assembly. */
export function createWorkshopHD(THREE) {
  const root=new THREE.Group();
  root.name='EDM28_HD_Brake_Suspension';
  const nodes=new Map(),pickables=[],meshes=[],materials=[];
  const mat=(color,metalness,roughness,more={})=>{
    const m=new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:metalness>.4?.32:.05,clearcoatRoughness:.26,...more});
    materials.push(m);return m;
  };
  const steel=mat('#b4bdc7',.88,.3),brushed=mat('#89949e',.82,.39);
  const forged=mat('#79848f',.76,.4),roughAlloy=mat('#a9b1bc',.71,.45);
  const graphite=mat('#202730',.38,.58),rubber=mat('#13181f',.08,.91);
  const friction=mat('#4b4642',.13,.87),anodized=mat('#c63437',.65,.29);
  const gloss=mat('#e4e9ed',.75,.22),gold=mat('#bca477',.72,.35);
  const ink=mat('#212a31',.24,.6),boot=mat('#282e34',.05,.92);
  const springPaint=mat('#bb2230',.4,.24),hoseMat=mat('#11151a',.06,.89);
  function mesh(parent,geometry,material,pos=[0,0,0],rot=[0,0,0],id=null){
    const m=new THREE.Mesh(geometry,material);
    m.position.set(...pos);m.rotation.set(...rot);
    m.castShadow=true;m.receiveShadow=true;parent.add(m);meshes.push(m);
    if(id){m.userData.partId=id;pickables.push(m);}
    return m;
  }
  function group(name){
    const node=new THREE.Group();
    node.name=name;node.userData.target=new THREE.Vector3();root.add(node);nodes.set(name,node);return node;
  }
  function cylinder(parent,r1,r2,depth,m,pos,rot=[0,0,Math.PI/2],id=null,sides=64){
    return mesh(parent,new THREE.CylinderGeometry(r1,r2,depth,sides,1,false),m,pos,rot,id);
  }
  function sphere(parent,r,m,pos,id=null){
    return mesh(parent,new THREE.SphereGeometry(r,24,16),m,pos,[0,0,0],id);
  }
  function bar(parent,a,b,r,m,id=null,ends=14){
    const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b);
    const length=v1.distanceTo(v2);
    const item=mesh(parent,new THREE.CylinderGeometry(r*.94,r,length,ends,1),m,
      v1.clone().add(v2).multiplyScalar(.5).toArray(),[0,0,0],id);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v2.sub(v1).normalize());
    return item;
  }
  function line(parent,points,r,m,id=null){
    return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.min(640,Math.max(32,points.length*2)),r,9,false),m,[0,0,0],[0,0,0],id);
  }
  function torus(parent,r,t,material,pos,rot=[0,Math.PI/2,0],id=null){
    return mesh(parent,new THREE.TorusGeometry(r,t,13,96),material,pos,rot,id);
  }
  function bolt(parent,pos,size=.035,id=null){
    cylinder(parent,size,size,.035,steel,pos,[0,0,Math.PI/2],id,6);
    cylinder(parent,size*.44,size*.44,.045,graphite,[pos[0]+.026,pos[1],pos[2]],[0,0,Math.PI/2],id,6);
  }
  function roundedBox(parent,w,h,d,r,material,pos,id=null){
    const x=-w/2,y=-h/2;
    const shape=new THREE.Shape();
    shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);
    shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);
    shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
    const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.012,d-r*2),steps:1,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,curveSegments:9});
    g.translate(0,0,-(d-r*2)/2);
    return mesh(parent,g,material,pos,[0,Math.PI/2,0],id);
  }
  function outline(parent,points,thickness,m,pos,id){
    const s=new THREE.Shape();
    points.forEach(([a,b],i)=>i?s.lineTo(a,b):s.moveTo(a,b));
    s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:thickness-.038,steps:1,bevelEnabled:true,bevelSegments:3,bevelThickness:.019,bevelSize:.018,curveSegments:10});
    g.translate(0,0,-(thickness-.038)/2);
    return mesh(parent,g,m,pos,[0,Math.PI/2,0],id);
  }
  function ring(parent,rOuter,rInner,depth,pos,material,id,drill=false) {
    const s=new THREE.Shape();
    s.absarc(0,0,rOuter,0,Math.PI*2,false);
    const bore=new THREE.Path();bore.absarc(0,0,rInner,0,Math.PI*2,true);s.holes.push(bore);
    if(drill){
      for(const [radius,count,size] of [[.57,24,.018],[.71,30,.019]]){
        for(let i=0;i<count;i++){
          const a=(i+.19*(count===24?1:2))*Math.PI*2/count;
          const h=new THREE.Path();
          h.absarc(radius*Math.cos(a),radius*Math.sin(a),size,0,Math.PI*2,true);
          s.holes.push(h);
        }
      }
    }
    const g=new THREE.ExtrudeGeometry(s,{depth,steps:1,bevelEnabled:false,curveSegments:7});
    g.translate(0,0,-depth/2);g.rotateY(Math.PI/2);
    return mesh(parent,g,material,pos,[0,0,0],id);
  }
  function fitStudio(){
    root.scale.setScalar(1);
    root.position.set(0,0,0);
    root.visible=true;
  }

  const hub=group('moyeu');
  cylinder(hub,.235,.245,.23,forged,[0,1.40,0],[0,0,Math.PI/2],'moyeu',96);
  cylinder(hub,.145,.145,.29,steel,[.14,1.40,0],[0,0,Math.PI/2],'moyeu');
  cylinder(hub,.10,.10,.30,graphite,[.27,1.40,0],[0,0,Math.PI/2],'moyeu');
  torus(hub,.216,.024,steel,[.08,1.40,0],[0,Math.PI/2,0],'moyeu');
  for(let j=0;j<5;j++){
    const a=j/5*Math.PI*2;
    const y=1.40+Math.cos(a)*.165,z=Math.sin(a)*.165;
    cylinder(hub,.019,.019,.22,gold,[.30,y,z],[0,0,Math.PI/2],'moyeu',12);
    bolt(hub,[.43,y,z],.025,'moyeu');
  }
  // Cast steering knuckle with forged contours, bearing housing and articulated mounting points.
  const knuckle=group('porte-fusee');
  outline(knuckle,[[-.24,-.55],[.0,-.79],[.24,-.58],[.31,-.27],[.27,.24],[.12,.57],[-.16,.60],[-.31,.28]],.16,forged,[-.24,1.40,-.05],'rotules');
  cylinder(knuckle,.235,.235,.17,roughAlloy,[-.20,1.40,0],[0,0,Math.PI/2],'disques',80);
  bar(knuckle,[-.34,.82,-.05],[-.40,.48,-.28],.095,forged,'triangles');
  sphere(knuckle,.105,steel,[-.40,.48,-.28],'triangles');
  bar(knuckle,[-.32,1.70,-.10],[-.45,2.12,-.23],.068,forged,'stabilisation');
  for(let j=0;j<5;j++){const a=j/5*Math.PI*2;bolt(knuckle,[-.096,1.40+Math.cos(a)*.18,Math.sin(a)*.18],.024,'disques');}

  const rotor=group('disques');
  // Two actual drilled rotor plates, connected with visible radial cooling vanes.
  ring(rotor,.825,.275,.047,[.096,1.40,0],steel,'disques',true);
  ring(rotor,.825,.275,.047,[-.055,1.40,0],brushed,'disques',true);
  ring(rotor,.292,.195,.13,[.06,1.40,0],graphite,'disques',false);
  cylinder(rotor,.201,.201,.18,graphite,[.125,1.40,0],[0,0,Math.PI/2],'disques',80);
  for(let i=0;i<36;i++){
    const angle=i*Math.PI*2/36;
    const y=1.40+Math.cos(angle)*.50,z=Math.sin(angle)*.50;
    const ny=Math.cos(angle)*.15,nz=Math.sin(angle)*.15;
    bar(rotor,[.035,y-ny,z-nz],[.035,y+ny,z+nz],.024,brushed,'disques',12);
  }
  for(const x of [-.088,.130]){
    torus(rotor,.78,.007,brushed,[x,1.40,0],[0,Math.PI/2,0],'disques');
    torus(rotor,.29,.008,steel,[x,1.40,0],[0,Math.PI/2,0],'disques');
  }
  for(let i=0;i<10;i++){
    const a=i*Math.PI*2/10;
    cylinder(rotor,.018,.018,.02,forged,[.17,1.40+Math.cos(a)*.245,Math.sin(a)*.245],[0,0,Math.PI/2],'disques',6);
  }
  const caliper=group('etrier');
  // Fixed, two-sided four-piston caliper. Forged curved casting plus stainless bridge and bolts.
  const caliperPos=[-.0,1.67,-.655];
  const shell=[
    [-.37,-.16],[-.36,.02],[-.26,.23],[-.04,.31],[.22,.30],[.39,.10],
    [.39,-.13],[.26,-.24],[-.17,-.24]
  ];
  for(const faceX of [-.23,.25]){
    outline(caliper,shell,.115,anodized,[faceX,caliperPos[1],caliperPos[2]],'etrier');
    for(const q of [-.16,.12]){
      cylinder(caliper,.094,.094,.036,graphite,[faceX+Math.sign(faceX)*.09,caliperPos[1]+q,caliperPos[2]+.02],[0,0,Math.PI/2],'etrier',40);
      torus(caliper,.083,.012,steel,[faceX+Math.sign(faceX)*.111,caliperPos[1]+q,caliperPos[2]+.02],[0,Math.PI/2,0],'etrier');
    }
  }
  for(const z of [-.89,-.43]){
    bar(caliper,[-.29,1.91,z],[.30,1.91,z],.036,steel,'etrier');
    bolt(caliper,[.34,1.91,z],.04,'etrier');
  }
  roundedBox(caliper,.21,.08,.63,.026,anodized,[0,1.98,-.66],'etrier');
  roundedBox(caliper,.27,.10,.52,.025,anodized,[0,1.41,-.65],'etrier');
  for(const z of [-.83,-.47]){
    cylinder(caliper,.026,.026,.20,gold,[.39,1.86,z],[0,0,Math.PI/2],'etrier',12);
    cylinder(caliper,.023,.018,.066,steel,[.54,1.86,z],[0,0,Math.PI/2],'etrier',8);
  }
  // Piston housing, spring clips and bleed nipple.
  cylinder(caliper,.032,.032,.09,steel,[.42,1.96,-.57],[Math.PI/2,0,0],'etrier',12);
  sphere(caliper,.037,steel,[.43,2.02,-.57],'etrier');
  for(let t=0;t<4;t++){
    const z=-.84+t*.12;
    bar(caliper,[-.20,2.0,z],[.25,2.0,z],.011,steel,'etrier');
  }
  const pads=group('plaquettes');
  for(const face of [-1,1]){
    const x=face*.145;
    roundedBox(pads,.22,.36,.034,.014,graphite,[x,1.69,-.67],'plaquettes');
    roundedBox(pads,.205,.31,.029,.014,friction,[x+face*.025,1.69,-.67],'plaquettes');
    bar(pads,[x,1.85,-.80],[x,1.86,-.55],.017,gold,'plaquettes');
    cylinder(pads,.032,.032,.015,steel,[x+face*.048,1.80,-.67],[0,0,Math.PI/2],'plaquettes',10);
  }
  const hydraulic=group('hydraulique');
  line(hydraulic,[[.14,1.93,-.74],[-.09,2.19,-.84],[-.36,2.46,-.78],[-.51,2.78,-.72]],.026,hoseMat,'liquide');
  for(const p of [[.14,1.93,-.74],[-.36,2.46,-.78]]){
    cylinder(hydraulic,.051,.051,.11,graphite,p,[0,0,Math.PI/2],'liquide',14);
    cylinder(hydraulic,.03,.03,.13,steel,[p[0]+.03,p[1],p[2]],[0,0,Math.PI/2],'liquide',16);
  }

  const strut=group('amortisseur');
  // Detailed damper: lower tube, shaft, spring seats, 7.4-turn helical coil, mount and bellows.
  bar(strut,[-.53,.78,.15],[-.71,2.30,.13],.112,graphite,'amortisseur',40);
  bar(strut,[-.70,2.14,.13],[-.78,2.78,.13],.056,gloss,'amortisseur',36);
  cylinder(strut,.158,.158,.056,forged,[-.74,2.12,.13],[0,0,0],'amortisseur',64);
  cylinder(strut,.169,.169,.065,graphite,[-.80,2.60,.13],[0,0,0],'amortisseur',64);
  const springPoints=[];
  for(let i=0;i<=288;i++){
    const t=i/288,angle=t*Math.PI*2*7.5;
    springPoints.push([-.73+Math.cos(angle)*.155,2.14+t*.43,.13+Math.sin(angle)*.155]);
  }
  line(strut,springPoints,.025,springPaint,'amortisseur');
  cylinder(strut,.121,.121,.04,roughAlloy,[-.80,2.79,.13],[0,0,0],'amortisseur',64);
  cylinder(strut,.091,.091,.05,rubber,[-.80,2.85,.13],[0,0,0],'amortisseur',48);
  for(let i=0;i<9;i++){
    const v=1.59+i*.048;
    torus(strut,.094-i*.004,.015,boot,[-.64,v,.135],[Math.PI/2,0,0],'amortisseur');
  }
  bar(strut,[-.58,.95,.14],[-.41,.51,.05],.052,forged,'triangles');
  cylinder(strut,.09,.09,.075,forged,[-.49,.59,.07],[0,0,0],'triangles',32);

  const control=group('triangles');
  // Forged lower wishbone, two actual bushings and a steel ball joint.
  const innerA=[-.95,.54,-.58],innerB=[-.95,.54,.48],outer=[-.18,.55,-.08];
  for(const from of [innerA,innerB]){
    bar(control,from,outer,.094,roughAlloy,'triangles',24);
    cylinder(control,.146,.146,.18,graphite,from,[0,Math.PI/2,0],'triangles',48);
    cylinder(control,.084,.084,.22,steel,from,[0,Math.PI/2,0],'triangles',48);
    for(const o of [-.12,.12]){
      cylinder(control,.092,.092,.013,brushed,[from[0]+o,from[1],from[2]],[0,0,Math.PI/2],'triangles',32);
    }
  }
  bar(control,[-.76,.54,-.40],[-.76,.54,.31],.064,roughAlloy,'triangles',20);
  sphere(control,.121,graphite,outer,'triangles');
  bar(control,[-.18,.55,-.08],[-.14,.83,-.04],.078,steel,'triangles');
  for(let i=0;i<5;i++){
    torus(control,.083,.013,boot,[-.18,.62+i*.04,-.08],[Math.PI/2,0,0],'triangles');
  }

  const steering=group('rotules');
  const tieStart=[-.28,1.25,.39],tieEnd=[-1.30,1.35,.87];
  bar(steering,tieStart,tieEnd,.044,steel,'rotules',18);
  sphere(steering,.098,graphite,tieStart,'rotules');
  cylinder(steering,.13,.115,.14,boot,[-.42,1.26,.46],[0,Math.PI/2,0],'rotules',24);
  for(let j=0;j<7;j++){
    cylinder(steering,.11-j*.005,.11-j*.005,.01,rubber,[-.43-j*.047,1.265+j*.004,.47+j*.01],[0,Math.PI/2,0],'rotules',24);
  }
  sphere(steering,.072,graphite,tieEnd,'rotules');
  bolt(steering,[-1.31,1.41,.87],.042,'rotules');
  const stabilizer=group('stabilisation');
  bar(stabilizer,[-.44,.75,-.21],[-.97,1.59,-.44],.043,steel,'stabilisation',20);
  sphere(stabilizer,.077,graphite,[-.44,.75,-.21],'stabilisation');
  sphere(stabilizer,.077,graphite,[-.97,1.59,-.44],'stabilisation');
  for(const p of [[-.44,.75,-.21],[-.97,1.59,-.44]]){
    cylinder(stabilizer,.078,.078,.105,boot,p,[0,0,Math.PI/2],'stabilisation',24);
    bolt(stabilizer,[p[0]+.095,p[1],p[2]],.043,'stabilisation');
  }

  const wheel=group('roue');
  const wheelCenter=[.34,1.40,0];
  torus(wheel,.95,.185,rubber,wheelCenter,[0,Math.PI/2,0],'__wheel__');
  for(const x of [.12,.51]){
    torus(wheel,.86,.044,ink,[x,1.40,0],[0,Math.PI/2,0],'__wheel__');
  }
  cylinder(wheel,.745,.745,.10,graphite,[.48,1.40,0],[0,0,Math.PI/2],'__wheel__',96);
  torus(wheel,.745,.019,gloss,[.555,1.40,0],[0,Math.PI/2,0],'__wheel__');
  cylinder(wheel,.16,.16,.15,brushed,[.52,1.40,0],[0,0,Math.PI/2],'__wheel__',64);
  for(let j=0;j<12;j++){
    const a=j*Math.PI*2/12;
    const from=[.56,1.40+Math.cos(a)*.22,Math.sin(a)*.22];
    const to=[.56,1.40+Math.cos(a+.07)*.68,Math.sin(a+.07)*.68];
    bar(wheel,from,to,.038,gloss,'__wheel__',12);
    cylinder(wheel,.046,.046,.06,graphite,[.58,1.40+Math.cos(a)*.70,Math.sin(a)*.70],[0,0,Math.PI/2],'__wheel__',16);
  }
  for(let j=0;j<5;j++){
    const a=j*Math.PI*2/5;
    bolt(wheel,[.64,1.40+Math.cos(a)*.14,Math.sin(a)*.14],.032,'__wheel__');
  }

  // Piecewise disassembly positions; no mechanical torques or repair operations are implied.
  const brakeOrder=['roue','etrier','plaquettes','disques','moyeu'];
  const suspensionOrder=['roue','triangles','rotules','stabilisation','amortisseur'];
  const targets={
    roue:[2.25,-.12,.40],
    etrier:[1.06,.28,-.38],
    plaquettes:[1.65,-.03,-.58],
    disques:[1.30,-.06,.12],
    moyeu:[.72,-.24,.42],
    triangles:[-.60,-.30,-.57],
    rotules:[-.80,.09,.52],
    stabilisation:[-.64,.20,-.46],
    amortisseur:[-.50,.30,.55]
  };
  function setState({family='freinage',step=1,side=1,front=true}={}){
    const order=family==='liaison'&&front?suspensionOrder:brakeOrder;
    const stage=Math.min(order.length,Math.max(0,Math.floor(Number(step)||0)));
    for(const [name,node] of nodes){
      const index=order.indexOf(name);
      const moved=index>=0&&stage>index;
      const out=targets[name];
      node.userData.target.set(0,0,0);
      if(out&&moved)node.userData.target.set(out[0],out[1],out[2]);
      // Brake parts remain visible in suspension mode, and vice versa.
    }
    root.visible=true;
  }
  function animate(amount){
    for(const node of nodes.values())node.position.lerp(node.userData.target,amount);
  }
  fitStudio();
  return {root,nodes,pickables,meshes,materials,setState,animate,dispose(){
    for(const object of meshes)object.geometry.dispose();
    for(const material of materials)material.dispose();
  }};
}
