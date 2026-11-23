export function createGt3Wheel(THREE) {
  const root=new THREE.Group();
  root.name='roue';
  const geometries=new Set(),materials=new Set(),instances=[];
  const centerY=1.40;
  const material=options=>{
    const value=new THREE.MeshPhysicalMaterial(options);
    materials.add(value);
    return value;
  };
  const rubber=material({color:'#1b1d20',roughness:.84,metalness:0});
  const mouldedRubber=material({color:'#25282b',roughness:.78,metalness:0});
  const groove=material({color:'#080a0c',roughness:.98,metalness:0});
  const red=material({color:'#bc122c',roughness:.27,metalness:.62,clearcoat:.65,clearcoatRoughness:.2});
  const rimInside=material({color:'#550d19',roughness:.38,metalness:.68});
  const alloy=material({color:'#b9c0c4',roughness:.29,metalness:.88});
  const darkAlloy=material({color:'#3b4247',roughness:.36,metalness:.8});
  const mark=material({color:'#ded6b3',roughness:.6,metalness:.1});
  const tag=mesh=>{
    mesh.userData.partId='__wheel__';
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    root.add(mesh);
    return mesh;
  };
  const mesh=(geometry,mat,position=[0,0,0],rotation=[0,0,0])=>{
    geometries.add(geometry);
    const value=tag(new THREE.Mesh(geometry,mat));
    value.position.set(...position);
    value.rotation.set(...rotation);
    return value;
  };
  const lathe=(profile,mat)=>{
    const geometry=new THREE.LatheGeometry(profile.map(([radius,x])=>new THREE.Vector2(radius,x)),128);
    geometry.rotateZ(-Math.PI/2);
    return mesh(geometry,mat,[.34,centerY,0]);
  };
  const torus=(radius,tube,x,mat)=>mesh(new THREE.TorusGeometry(radius,tube,6,96),mat,[x,centerY,0],[0,Math.PI/2,0]);
  const cylinder=(radius,depth,x,mat,segments=64)=>mesh(new THREE.CylinderGeometry(radius,radius,depth,segments),mat,[x,centerY,0],[0,0,Math.PI/2]);
  const repeated=(geometry,mat,count,transform)=>{
    geometries.add(geometry);
    const value=tag(new THREE.InstancedMesh(geometry,mat,count));
    const dummy=new THREE.Object3D();
    for(let i=0;i<count;i++){
      transform(dummy,i);
      dummy.updateMatrix();
      value.setMatrixAt(i,dummy.matrix);
    }
    value.instanceMatrix.needsUpdate=true;
    value.computeBoundingSphere();
    instances.push(value);
    return value;
  };

  lathe([
    [1.005,-.28],[1.025,-.295],[1.065,-.296],[1.125,-.281],
    [1.18,-.25],[1.22,-.205],[1.242,-.16],[1.25,-.125],
    [1.25,-.109],[1.237,-.102],[1.237,-.087],[1.25,-.081],
    [1.25,-.013],[1.238,-.007],[1.238,.007],[1.25,.013],
    [1.25,.081],[1.237,.087],[1.237,.102],[1.25,.109],
    [1.25,.125],[1.242,.16],[1.22,.205],[1.18,.25],
    [1.125,.281],[1.065,.296],[1.025,.295],[1.005,.28],
    [.985,.25],[.985,-.25],[1.005,-.28]
  ],rubber);
  for(const x of [.046,.634]){
    torus(1.065,.0035,x,mouldedRubber);
    torus(1.023,.006,x,mouldedRubber);
  }

  const groovePath=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.205,1.224,-.026),
    new THREE.Vector3(-.16,1.245,-.008),
    new THREE.Vector3(-.13,1.252,.006),
    new THREE.Vector3(-.115,1.252,.011)
  ]);
  repeated(new THREE.TubeGeometry(groovePath,5,.0038,4,false),groove,80,(dummy,i)=>{
    dummy.position.set(.34,centerY,0);
    dummy.rotation.set(i>=40?Math.PI:0,0,i>=40?Math.PI:0);
    if(i<40)dummy.rotation.x=i*Math.PI*2/40;
    else dummy.rotation.x=(i-40+.5)*Math.PI*2/40;
  });

  lathe([[.948,-.245],[.986,-.245],[1.01,-.226],[1.012,-.205],
    [.99,-.189],[.974,-.17],[.968,.20],[.986,.265],[1.013,.278],
    [1.013,.302],[.995,.313],[.967,.302],[.95,.282],[.935,.215],
    [.934,-.185],[.948,-.245]],rimInside);
  torus(.998,.018,.639,red);
  torus(.963,.008,.653,red);
  torus(.993,.012,.112,red);

  const spoke=new THREE.Shape();
  spoke.moveTo(-.062,.17);
  spoke.quadraticCurveTo(-.079,.31,-.1,.44);
  spoke.lineTo(-.221,.925);
  spoke.quadraticCurveTo(-.197,.966,-.158,.969);
  spoke.lineTo(-.042,.561);
  spoke.quadraticCurveTo(0,.447,.042,.561);
  spoke.lineTo(.158,.969);
  spoke.quadraticCurveTo(.197,.966,.221,.925);
  spoke.lineTo(.1,.44);
  spoke.quadraticCurveTo(.079,.31,.062,.17);
  spoke.closePath();
  const spokeGeometry=new THREE.ExtrudeGeometry(spoke,{depth:.049,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:.009,bevelThickness:.008,curveSegments:5});
  const positions=spokeGeometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const u=positions.getX(i),v=positions.getY(i),depth=positions.getZ(i);
    const radius=Math.hypot(u,v);
    positions.setXYZ(i,.506+.1*radius*radius+depth,v,-u);
  }
  spokeGeometry.computeVertexNormals();
  repeated(spokeGeometry,red,7,(dummy,i)=>{
    dummy.position.set(0,centerY,0);
    dummy.rotation.set(i*Math.PI*2/7,0,0);
  });

  cylinder(.222,.075,.555,red);
  cylinder(.161,.073,.612,darkAlloy,12);
  cylinder(.126,.038,.665,alloy,12);
  cylinder(.077,.044,.681,darkAlloy,48).name='wheel-center-lock';
  torus(.153,.009,.655,alloy);
  torus(.071,.004,.706,alloy);
  const stamp=new THREE.BoxGeometry(.006,.067,.009);
  mesh(stamp,mark,[.708,centerY,0],[.3,0,0]);
  mesh(new THREE.CylinderGeometry(.009,.011,.06,12),darkAlloy,[.648,centerY+.794,.49],[0,0,Math.PI/2]);
  mesh(new THREE.CylinderGeometry(.014,.014,.025,12),alloy,[.683,centerY+.794,.49],[0,0,Math.PI/2]);

  return {root,dispose(){
    instances.forEach(item=>item.dispose());
    geometries.forEach(geometry=>geometry.dispose());
    materials.forEach(value=>value.dispose());
  }};
}
