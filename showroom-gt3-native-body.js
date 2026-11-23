/* Original EDM28 sports coupe. Curved surfaces keep the wheel wells open. */
export function createGt3Body(THREE) {
  const root=new THREE.Group();
  root.name='carrosserie';
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const material=properties=>{
    const value=new THREE.MeshPhysicalMaterial(properties);materials.add(value);return value;
  };
  const paint=material({color:'#e5e6e2',metalness:.22,roughness:.25,clearcoat:1,clearcoatRoughness:.14});
  const edgePaint=material({color:'#c8cece',metalness:.28,roughness:.3,clearcoat:.8});
  const black=material({color:'#0b1118',metalness:.15,roughness:.52});
  const seal=material({color:'#080c11',metalness:0,roughness:.76});
  const glass=material({color:'#101b27',metalness:.24,roughness:.11,clearcoat:1,clearcoatRoughness:.07,side:THREE.DoubleSide});
  const lens=material({color:'#253442',metalness:.2,roughness:.10,clearcoat:1});
  const steel=material({color:'#8e9aa5',metalness:.92,roughness:.25});
  const red=material({color:'#b71530',metalness:.46,roughness:.29,clearcoat:.8});
  const led=material({color:'#edfbff',metalness:.05,roughness:.16,emissive:'#cfedff',emissiveIntensity:2});
  const tail=material({color:'#e21733',metalness:.1,roughness:.19,emissive:'#e70824',emissiveIntensity:1.8});
  const weaveData=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const horizontal=((Math.floor(x/8)+Math.floor(y/8))%4)<2;
    const rib=horizontal?y%8:x%8;
    const shade=25+Math.round(17*Math.sin((rib+.5)*Math.PI/8))+(horizontal?4:0);
    const p=(y*64+x)*4;
    weaveData[p]=shade;weaveData[p+1]=shade+3;weaveData[p+2]=shade+5;weaveData[p+3]=255;
  }
  const weave=new THREE.DataTexture(weaveData,64,64);
  weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(8,8);
  weave.colorSpace=THREE.SRGBColorSpace;weave.needsUpdate=true;textures.add(weave);
  const carbon=material({color:'#b9c0c7',map:weave,metalness:.32,roughness:.37,clearcoat:.58,clearcoatRoughness:.23,side:THREE.DoubleSide});
  const mesh=(name,geometry,mat,parent=root,position=[0,0,0],rotation=[0,0,0],scale)=>{
    geometries.add(geometry);
    const item=new THREE.Mesh(geometry,mat);item.name=name;
    item.position.set(...position);item.rotation.set(...rotation);
    if(scale)item.scale.set(...scale);
    item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;
  };
  const surface=(name,nu,nv,point,mat=paint,reverse=false,parent=root)=>{
    const positions=[],uv=[],indices=[];
    for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
      positions.push(...point(i/nu,j/nv));uv.push(i/nu,j/nv);
    }
    for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
      const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;
      indices.push(...(reverse?[a,b,c,b,d,c]:[a,c,b,b,c,d]));
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    return mesh(name,geometry,mat,parent);
  };
  const tube=(name,points,radius,mat,parent=root,closed=false)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');
    return mesh(name,new THREE.TubeGeometry(curve,Math.min(160,Math.max(24,points.length*5)),radius,8,closed),mat,parent);
  };
  const box=(name,size,mat,position,rotation=[0,0,0],parent=root)=>mesh(name,new THREE.BoxGeometry(...size),mat,parent,position,rotation);
  const oval=(name,mat,position,scale,parent=root,rotation=[0,0,0])=>mesh(name,new THREE.SphereGeometry(1,40,24),mat,parent,position,rotation,scale);
  const shapeMesh=(name,points,depth,mat,position,rotation=[0,0,0],parent=root)=>{
    const shape=new THREE.Shape();
    points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:3});
    return mesh(name,geo,mat,parent,position,rotation);
  };
  const stations=[
    [-2.55,.88,.96,.92],[-2.35,1.10,1.08,1.03],[-2.03,1.21,1.20,1.08],
    [-1.51,1.24,1.31,1.11],[-.96,1.10,1.12,1.06],[-.35,1.04,1.075,1.055],
    [.46,1.035,1.105,1.07],[.92,1.13,1.18,1.095],[1.46,1.22,1.31,1.10],
    [1.94,1.17,1.24,1.07],[2.32,1.06,1.08,.98],[2.55,.89,.83,.82]
  ];
  const section=z=>{
    let i=0;while(i<stations.length-2&&z>stations[i+1][0])i++;
    const a=stations[i],b=stations[i+1],p=stations[Math.max(0,i-1)],n=stations[Math.min(stations.length-1,i+2)];
    const span=b[0]-a[0],t=THREE.MathUtils.clamp((z-a[0])/span,0,1);
    return [1,2,3].map(k=>{
      const m0=(b[k]-p[k])/(b[0]-p[0])*span,m1=(n[k]-a[k])/(n[0]-a[0])*span;
      return (2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*m1;
    });
  };
  const endProfile=(z,fraction)=>z
    -.13*fraction*fraction*THREE.MathUtils.clamp((z-2.06)/.49,0,1)**2
    +.15*fraction*fraction*THREE.MathUtils.clamp((-z-2.28)/.27,0,1)**2;
  const upper=(fraction,z,lift=0)=>{
    const [width,shoulder,center]=section(z),t=Math.abs(fraction);
    return [fraction*width,center+(shoulder-center)*Math.sin(t*Math.PI/2)**3-.022*t**16+lift,endProfile(z,fraction)];
  };
  surface('sculpted-upper-body',64,144,(u,v)=>upper(u*2-1,-2.55+5.10*v));
  for(const side of [-1,1]){
    for(const [start,end,axle] of [[-2.55,-2.08,null],[-2.08,-.94,-1.51],[-.94,.89,null],[.89,2.03,1.46],[2.03,2.55,null]]){
      surface('curved-flank',48,16,(u,v)=>{
        const z=start+(end-start)*u,[w,h]=section(z);
        const lower=axle===null?.315:.642+Math.sqrt(Math.max(0,.57**2-(z-axle)**2));
        return [side*w*(.955+.045*Math.sin(v*Math.PI/2)),lower+(h-.022-lower)*v,endProfile(z,1)];
      },paint,side<0);
    }
    for(const z of [-1.51,1.46]){
      const edge=[];
      for(let i=0;i<=32;i++){
        const angle=i*Math.PI/32,zz=z+.57*Math.cos(angle);
        edge.push([side*(section(zz)[0]*.955+.008),.642+.57*Math.sin(angle),zz]);
      }
      tube('painted-wheel-arch',edge,.016,paint);
      surface('wheel-well-liner',40,6,(u,v)=>{
        const angle=-.32+(Math.PI+.64)*u,zz=z+.585*Math.cos(angle);
        return [side*(section(THREE.MathUtils.clamp(zz,-2.55,2.55))[0]*.955-.24*v),.642+.585*Math.sin(angle),zz];
      },black,side<0);
    }
    surface('sculpted-rocker',48,5,(u,v)=>{
      const z=-.91+1.77*u;
      return [side*(1.028+.06*Math.sin(v*Math.PI)),.28+.11*v,z];
    },carbon,side<0);
    tube('red-sill-pinstripe',[[side*1.04,.385,-.87],[side*1.025,.39,-.2],[side*1.04,.393,.82]],.008,red);
    const seamPoints=[[.78,1.12],[.63,.79],[.55,.44],[-.64,.425],[-.84,.68],[-.91,1.10]];
    tube('door-shutline',seamPoints.map(([z,y])=>[side*(section(z)[0]-.005),y,z]),.0045,seal);
    oval('flush-door-handle',black,[side*1.079,1.03,-.51],[.014,.021,.105]);
    tube('mirror-stalk',[[side*.91,1.18,.70],[side*1.10,1.25,.71],[side*1.23,1.27,.65]],.022,carbon);
    oval('mirror-housing',paint,[side*1.25,1.28,.63],[.16,.064,.14]);
    oval('mirror-glass',steel,[side*1.251,1.283,.514],[.125,.044,.011]);
  }
  surface('front-bumper',64,24,(u,v)=>{
    const a=u*2-1,top=upper(a,2.55),x=a*.89*(.955+.045*Math.sin(v*Math.PI/2));
    return [x,.315+(top[1]-.315)*v,endProfile(2.55,a)+.065*Math.sin(v*Math.PI)*(1-a*a)];
  },paint,true);
  surface('rear-bumper',64,18,(u,v)=>{
    const a=u*2-1,top=upper(a,-2.55),x=a*.88*(.955+.045*Math.sin(v*Math.PI/2));
    return [x,.315+(top[1]-.315)*v,endProfile(-2.55,a)-.035*Math.sin(v*Math.PI)*(1-a*a)];
  },paint,false);
  const intake=(side)=>{
    const group=new THREE.Group();group.position.set(side*.60,.55,2.56);group.rotation.y=side*.20;root.add(group);
    shapeMesh('front-air-inlet',[[-.24,-.16],[.20,-.13],[.23,.12],[-.21,.15]],.035,black,[0,0,0],[0,0,0],group);
    for(let i=0;i<5;i++)box('intake-grille-slat',[.39,.011,.022],carbon,[0,-.095+i*.047,.038],[0,0,0],group);
    box('inlet-air-guide',[.018,.23,.055],carbon,[side*.10,-.005,.045],[0,side*.1,side*.13],group);
    box('front-running-light',[.30,.018,.025],led,[0,.184,.045],[0,0,0],group);
  };
  intake(-1);intake(1);
  shapeMesh('central-grille',[[-.35,-.10],[.35,-.10],[.32,.10],[-.32,.10]],.025,black,[0,.55,2.627]);
  for(let i=-6;i<=6;i++)box('grille-mesh',[.012,.18,.012],carbon,[i*.046,.55,2.658]);
  surface('front-splitter',64,8,(u,v)=>{
    const x=(u*2-1)*1.14;
    return [x,.279+.012*Math.sin(v*Math.PI),2.20+.43*v-.11*(x/1.14)**2];
  },carbon);
  tube('splitter-leading-edge',[[-1.14,.285,2.53],[-.82,.283,2.58],[0,.282,2.65],[.82,.283,2.58],[1.14,.285,2.53]],.013,carbon);
  for(const side of [-1,1]){
    const lamp=new THREE.Group();lamp.position.set(side*.80,1.145,2.18);lamp.rotation.x=.57;root.add(lamp);
    oval('headlamp-surround',seal,[0,0,0],[.224,.049,.29],lamp);
    oval('headlamp-lens',lens,[0,.029,0],[.198,.045,.263],lamp);
    const ring=[];
    for(let i=0;i<48;i++){const a=i*Math.PI*2/48;ring.push([.177*Math.cos(a),.067,.235*Math.sin(a)]);}
    tube('headlamp-led-signature',ring,.009,led,lamp,true);
    for(const x of [-.063,.063])for(const z of [-.094,.094]){
      oval('headlamp-projector',steel,[x,.074,z],[.044,.009,.053],lamp);
      box('headlamp-led-module',[.046,.01,.029],led,[x,.085,z],[0,0,0],lamp);
    }
    tube('bonnet-panel-gap',[upper(side*.53,.89,.008),upper(side*.56,1.22,.007),upper(side*.50,1.72,.007),upper(side*.47,2.15,.007)],.004,seal);
    surface('bonnet-extractor',10,22,(u,v)=>{
      const z=1.02+v*.52,f=side*(.19+.18*u);
      return upper(f,z,.009);
    },black,side<0);
    for(let i=0;i<5;i++){
      const z=1.09+i*.08;
      tube('bonnet-vent-louvre',[upper(side*.20,z,.020),upper(side*.28,z,.021),upper(side*.36,z,.021)],.009,carbon);
    }
    surface('fender-air-extractor',12,20,(u,v)=>upper(side*(.77+.15*u),1.18+.47*v,.009),carbon);
    for(let i=0;i<4;i++){
      const z=1.24+i*.10;
      tube('fender-louvre',[upper(side*.78,z,.022),upper(side*.85,z,.025),upper(side*.915,z,.022)],.009,black);
    }
  }
  const roofPoint=(u,v)=>{
    const t=u*2-1,z=-.70+.98*v,w=.713+.015*Math.sin(v*Math.PI);
    return [t*w,1.64-.054*t*t-.028*(2*v-1)**2,z];
  };
  surface('arched-roof',40,40,roofPoint);
  const windscreen=(u,v,rear=false)=>{
    const t=u*2-1,top=roofPoint(u,rear?0:1),z=rear?-1.40:.96;
    const lower=upper(t*.904/section(z)[0],z,.006);
    return [top[0]*(1-v)+lower[0]*v,top[1]*(1-v)+lower[1]*v+.027*(1-t*t)*Math.sin(v*Math.PI),top[2]*(1-v)+z*v+(rear?-1:1)*.034*(1-t*t)*Math.sin(v*Math.PI)];
  };
  surface('front-windscreen',40,32,(u,v)=>windscreen(u,v),glass);
  surface('rear-windscreen',40,32,(u,v)=>windscreen(u,v,true),glass,true);
  for(const rear of [false,true])for(const v of [0,1]){
    const points=[];for(let i=0;i<=24;i++)points.push(windscreen(i/24,v,rear));
    tube('windscreen-seal',points,.013,seal);
  }
  const sideGlass=(side,u,v)=>{
    const zBottom=-1.20+2.10*u,zTop=-.70+.98*u;
    const top=roofPoint(side>0?1:0,u),lower=upper(side*.969/section(zBottom)[0],zBottom,.016);
    return [lower[0]*(1-v)+top[0]*v+side*.018*Math.sin(v*Math.PI),lower[1]*(1-v)+top[1]*v,zBottom*(1-v)+zTop*v];
  };
  for(const side of [-1,1]){
    surface('side-window',40,20,(u,v)=>sideGlass(side,u,v),glass,side<0);
    for(const rear of [false,true])surface(rear?'rear-pillar-skin':'front-pillar-skin',8,24,(u,v)=>{
      const outer=sideGlass(side,rear?0:1,v),inner=windscreen(side>0?1:0,1-v,rear);
      return outer.map((value,index)=>value*(1-u)+inner[index]*u);
    },paint,rear?side>0:side<0);
    for(const u of [0,1]){
      const points=[];for(let i=0;i<=12;i++)points.push(sideGlass(side,u,i/12));
      tube(u?'a-pillar':'rear-pillar',points,.032,paint);
    }
    for(const v of [0,1]){
      const points=[];for(let i=0;i<=28;i++)points.push(sideGlass(side,i/28,v));
      tube('side-window-seal',points,.013,seal);
    }
    tube('quarter-window-divider',[sideGlass(side,.27,0),sideGlass(side,.27,.5),sideGlass(side,.27,1)],.016,black);
    const windowBottom=[];
    for(let i=0;i<=32;i++){const p=sideGlass(side,i/32,0);p[1]-=.021;windowBottom.push(p);}
    tube('window-beltline',windowBottom,.021,paint);
  }
  tube('windscreen-wiper',[[-.66,1.183,.92],[-.25,1.19,.922],[.08,1.20,.88]],.008,black);
  tube('windscreen-wiper',[[.12,1.182,.92],[.43,1.187,.91],[.72,1.19,.86]],.008,black);
  for(const side of [-1,1]){
    tube('roof-channel',[[-.69*side,1.60,-.66],[-.715*side,1.61,-.2],[-.69*side,1.60,.24]],.005,seal);
  }
  for(let i=-7;i<=7;i++){
    const x=i*.075;
    tube('rear-deck-vent',[[x,1.107,-1.78],[x,1.115,-1.57],[x,1.121,-1.43]],.013,carbon);
  }
  const tailPoints=[];
  for(let i=0;i<=48;i++){
    const x=-.985+1.97*i/48;
    tailPoints.push([x,.939+.02*(x/.985)**2,-2.564+.12*(x/.985)**2]);
  }
  tube('rear-light-recess',tailPoints,.037,black);
  tube('continuous-rear-led',tailPoints.map(([x,y,z])=>[x,y,z-.024]),.012,tail);
  shapeMesh('rear-plate-recess',[[-.39,-.12],[.39,-.12],[.42,.12],[-.42,.12]],.025,black,[0,.65,-2.595],[0,Math.PI,0]);
  box('rear-license-panel',[.48,.108,.012],edgePaint,[0,.65,-2.63]);
  surface('rear-diffuser',48,12,(u,v)=>{
    const x=(u*2-1)*1.065;
    return [x,.255+.19*v,-2.18-.47*v+.13*(x/1.065)**2];
  },carbon,true);
  for(const x of [-.92,-.66,-.40,.40,.66,.92])shapeMesh('diffuser-fin',[[0,0],[.44,.13],[.42,.24],[.05,.07]],.018,carbon,[x,.25,-2.17],[0,-Math.PI/2,0]);
  for(const x of [-.22,.22]){
    mesh('exhaust-outer',new THREE.CylinderGeometry(.086,.078,.21,48,1,true),steel,root,[x,.40,-2.64],[Math.PI/2,0,0]);
    mesh('exhaust-inner',new THREE.CylinderGeometry(.067,.066,.20,40,1,false),black,root,[x,.40,-2.62],[Math.PI/2,0,0]);
    mesh('exhaust-lip',new THREE.TorusGeometry(.077,.009,8,48),steel,root,[x,.40,-2.75]);
  }
  for(const side of [-1,1]){
    shapeMesh('swan-neck-wing-mount',[[-.05,0],[.08,.01],[.13,.46],[.02,.61],[-.13,.63],[-.15,.57],[-.02,.52]],.045,carbon,[side*.66,1.09,-2.15],[0,-Math.PI/2,0]);
  }
  surface('rear-airfoil',64,32,(u,v)=>{
    const x=(u*2-1)*1.22,a=v*Math.PI*2;
    return [x,1.735+.033*Math.sin(a)-.025*(x/1.22)**2,-2.29+.29*Math.cos(a)];
  },carbon,true);
  for(const side of [-1,1])shapeMesh('wing-endplate',[[-.30,-.065],[.28,-.04],[.29,.065],[.17,.12],[-.30,.085]],.025,carbon,[side*1.23,1.73,-2.29],[0,-Math.PI/2,0]);
  tube('wing-red-trailing-edge',[[-1.22,1.74,-2.58],[0,1.76,-2.58],[1.22,1.74,-2.58]],.008,red);
  box('underbody',[1.75,.065,3.7],black,[0,.30,-.07]);
  return {root,dispose(){
    geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());textures.forEach(value=>value.dispose());
  }};
}
