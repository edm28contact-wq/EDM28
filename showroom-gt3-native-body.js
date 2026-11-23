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
  const glass=material({color:'#101b27',metalness:.24,roughness:.11,envMapIntensity:.35,clearcoat:1,clearcoatRoughness:.07,side:THREE.DoubleSide});
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
    [-2.55,.86,1.10,1.02],[-2.30,1.09,1.18,1.08],[-1.98,1.22,1.28,1.12],
    [-1.51,1.25,1.34,1.13],[-.96,1.115,1.17,1.08],[-.35,1.04,1.10,1.06],
    [.46,1.05,1.13,1.08],[.92,1.13,1.22,1.10],[1.46,1.235,1.35,1.115],
    [1.94,1.18,1.27,1.075],[2.32,1.04,1.115,.98],[2.55,.84,.99,.90]
  ];
  const secondDerivatives=[1,2,3].map(k=>{
    const n=stations.length,diagonal=Array(n).fill(1),rhs=Array(n).fill(0),upperBand=Array(n).fill(0),lowerBand=Array(n).fill(0);
    for(let i=1;i<n-1;i++){
      const left=stations[i][0]-stations[i-1][0],right=stations[i+1][0]-stations[i][0];
      lowerBand[i]=left;diagonal[i]=2*(left+right);upperBand[i]=right;
      rhs[i]=6*((stations[i+1][k]-stations[i][k])/right-(stations[i][k]-stations[i-1][k])/left);
    }
    for(let i=1;i<n;i++){
      const factor=lowerBand[i]/diagonal[i-1];
      diagonal[i]-=factor*upperBand[i-1];rhs[i]-=factor*rhs[i-1];
    }
    for(let i=n-1;i>=0;i--)rhs[i]=(rhs[i]-(upperBand[i]*(rhs[i+1]||0)))/diagonal[i];
    return rhs;
  });
  const section=z=>{
    let i=0;while(i<stations.length-2&&z>stations[i+1][0])i++;
    const a=stations[i],b=stations[i+1],span=b[0]-a[0],t=THREE.MathUtils.clamp((z-a[0])/span,0,1),s=1-t;
    return [1,2,3].map(k=>s*a[k]+t*b[k]+((s**3-s)*secondDerivatives[k-1][i]+(t**3-t)*secondDerivatives[k-1][i+1])*span*span/6);
  };
  const endWeight=z=>THREE.MathUtils.clamp((Math.abs(z)-(z>0?2.04:2.08))/(z>0?.51:.47),0,1);
  const endProfile=(z,fraction)=>z
    -Math.sign(z)*(z>0?.18:.17)*fraction*fraction*endWeight(z)**2;
  const endRoll=z=>{
    const t=THREE.MathUtils.clamp((Math.abs(z)-2.18)/.37,0,1);
    return (z>0?.14:.10)*(1-Math.sqrt(Math.max(0,1-.98*t*t)))/(1-Math.sqrt(.02));
  };
  const shoulderRadius=.43,sideTuck=.12;
  const crown=(fraction,z)=>{
    const [width,shoulder,center]=section(z),t=THREE.MathUtils.clamp(fraction,-1,1);
    return [t*width,center+(shoulder-.025-center+shoulderRadius)*t**4-shoulderRadius*(1-Math.sqrt(Math.max(0,1-t*t)))-endRoll(z),endProfile(z,t)];
  };
  const lampHeight=crown(.80/section(2.16)[0],2.16)[1];
  const upper=(fraction,z,lift=0)=>{
    const p=crown(fraction,z),dx=Math.abs(p[0])-.80,dz=z-2.16,distance=(dx/.30)**2+(dz/.36)**2;
    if(distance<1){
      const t=1-distance,edge=THREE.MathUtils.clamp((1-fraction*fraction)/.18,0,1);
      const blend=t*t*(3-2*t)*edge*edge*(3-2*edge);
      p[1]=THREE.MathUtils.lerp(p[1],lampHeight-.55*dz-.10*(dx*dx+dz*dz),blend);
    }
    p[1]+=lift;return p;
  };
  const flank=(side,z,y)=>{
    const [w,h]=section(z),height=h-.025-endRoll(z);
    const depth=(h-.025-.315)*(1-(y-.315)/(height-.315));
    const x=w-sideTuck*(1-Math.exp(-w*depth*depth/(2*sideTuck*shoulderRadius**2)));
    const v=THREE.MathUtils.clamp((y-.315)/(height-.315),0,1);
    return [side*x,y,endProfile(z,x/w)+Math.sign(z)*(z>0?.12:.105)*endWeight(z)**2*Math.sin(v*Math.PI)**2];
  };
  const cap=(front,fraction,v)=>{
    const z=front?2.55:-2.55,[w,h]=section(z),height=h-.025-endRoll(z),f=THREE.MathUtils.clamp(fraction,-1,1);
    const x=f*flank(1,z,.315+(height-.315)*v)[0];
    return [x,.315+(upper(f,z)[1]-.315)*v,endProfile(z,x/w)+(front?.16:-.14)*(1-.25*f*f)*Math.sin(v*Math.PI)**2];
  };
  const capAt=(front,x,y,lift=0)=>{
    const z=front?2.55:-2.55,[,h]=section(z),height=h-.025-endRoll(z);
    let v=THREE.MathUtils.clamp((y-.315)/(height-.315),0,1),f=0;
    for(let i=0;i<8;i++){
      f=THREE.MathUtils.clamp(x/flank(1,z,.315+(height-.315)*v)[0],-1,1);
      v=THREE.MathUtils.clamp((y-.315)/(upper(f,z)[1]-.315),0,1);
    }
    const p=cap(front,f,v);p[2]+=(front?1:-1)*lift;return p;
  };
  const skin=[],ranges=[[-2.55,-2.08,null],[-2.08,-.94,-1.51],[-.94,.89,null],[.89,2.03,1.46],[2.03,2.55,null]];
  const stationZ=(start,end,t)=>start+(end-start)*(start===-2.55?1-Math.cos(t*Math.PI/2):end===2.55?Math.sin(t*Math.PI/2):t);
  for(const [start,end] of ranges)skin.push(surface('sculpted-upper-body',64,48,(u,v)=>upper(Math.sin((u-.5)*Math.PI),stationZ(start,end,v))));
  for(const side of [-1,1]){
    for(const [start,end,axle] of ranges){
      skin.push(surface('curved-flank',48,24,(u,v)=>{
        const z=stationZ(start,end,u),[,h]=section(z);
        const lower=axle===null?.315:.642+Math.sqrt(Math.max(0,.57**2-(z-axle)**2));
        return flank(side,z,lower+(h-.025-endRoll(z)-lower)*v);
      },paint,side<0));
    }
    for(const z of [-1.51,1.46]){
      const edge=[flank(side,z+.57,.315)];
      for(let i=0;i<=32;i++){
        const angle=i*Math.PI/32,zz=z+.57*Math.cos(angle);
        const p=flank(side,zz,.642+.57*Math.sin(angle));p[0]+=side*.006;edge.push(p);
      }
      edge.push(flank(side,z-.57,.315));
      tube('painted-wheel-arch',edge,.012,paint);
      surface('wheel-well-liner',40,6,(u,v)=>{
        const angle=-.32+(Math.PI+.64)*u,zz=z+.585*Math.cos(angle);
        const p=flank(side,zz,.642+.585*Math.sin(angle));p[0]-=side*.24*v;return p;
      },black,side<0);
    }
    surface('sculpted-rocker',48,5,(u,v)=>{
      const p=flank(side,-.91+1.77*u,.28+.12*v);p[0]+=side*.025*Math.sin(v*Math.PI);return p;
    },carbon,side<0);
    tube('red-sill-pinstripe',[-.87,-.2,.82].map(z=>{const p=flank(side,z,.405);p[0]+=side*.009;return p;}),.006,red);
    const seamPoints=[[.78,1.12],[.63,.79],[.55,.44],[-.64,.425],[-.84,.68],[-.91,1.10]];
    tube('door-shutline',seamPoints.map(([z,y])=>{const p=flank(side,z,y);p[0]+=side*.003;return p;}),.0035,seal);
    const handle=flank(side,-.51,1.03);handle[0]+=side*.006;
    oval('flush-door-handle',black,handle,[.012,.018,.095]);
    tube('mirror-stalk',[[side*.91,1.18,.70],[side*1.10,1.25,.71],[side*1.23,1.27,.65]],.022,carbon);
    oval('mirror-housing',paint,[side*1.25,1.28,.63],[.16,.064,.14]);
    oval('mirror-glass',steel,[side*1.251,1.283,.514],[.125,.044,.011]);
  }
  skin.push(surface('front-bumper',64,24,(u,v)=>cap(true,Math.sin((u-.5)*Math.PI),v),paint,true));
  skin.push(surface('rear-bumper',64,24,(u,v)=>cap(false,Math.sin((u-.5)*Math.PI),v),paint));
  const sharedNormals=new Map();
  for(const {geometry} of skin){
    const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
    for(let i=0;i<position.count;i++){
      const key=[position.getX(i),position.getY(i),position.getZ(i)].map(n=>Math.round(n*1e6)).join(',');
      let entry=sharedNormals.get(key);
      if(!entry){entry={sum:new THREE.Vector3(),vertices:[]};sharedNormals.set(key,entry);}
      entry.sum.add(new THREE.Vector3().fromBufferAttribute(normal,i));entry.vertices.push([normal,i]);
    }
  }
  for(const {sum,vertices} of sharedNormals.values())if(vertices.length>1){
    sum.normalize();for(const [normal,i] of vertices)normal.setXYZ(i,sum.x,sum.y,sum.z);
  }
  const roundedInset=(name,front,cx,cy,rx,ry)=>surface(name,48,10,(u,v)=>{
    const angle=u*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
    return capAt(front,cx+rx*Math.sign(c)*Math.abs(c)**.65*v,cy+ry*Math.sign(s)*Math.abs(s)**.65*v,.009);
  },black,!front);
  const intake=side=>{
    roundedInset('front-air-inlet',true,side*.56,.525,.185,.12);
    for(let i=0;i<5;i++)tube('intake-grille-slat',[-.15,0,.15].map(x=>capAt(true,side*.56+x,.44+i*.042,.018)),.0045,carbon);
    tube('front-running-light',[-.13,0,.13].map(x=>capAt(true,side*.56+x,.683,.014)),.008,led);
  };
  intake(-1);intake(1);
  roundedInset('central-grille',true,0,.505,.285,.095);
  for(let i=-5;i<=5;i++)tube('grille-mesh',[.43,.50,.58].map(y=>capAt(true,i*.048,y,.018)),.004,carbon);
  surface('front-splitter',64,8,(u,v)=>{
    const f=u*2-1;
    return [f*1.07,.279+.012*Math.sin(v*Math.PI),(2.16-.14*f*f)*(1-v)+(2.68-.42*f*f)*v];
  },carbon);
  tube('splitter-leading-edge',Array.from({length:25},(_,i)=>{const f=i/12-1;return [f*1.07,.282,2.68-.42*f*f];}),.011,carbon);
  for(const side of [-1,1]){
    const lampPoint=(x,z,lift=0)=>upper((side*.80+x)/section(2.16+z)[0],2.16+z,lift);
    const lampSurface=(name,rx,rz,lift,mat)=>surface(name,48,14,(u,v)=>{
      const angle=u*Math.PI*2;
      return lampPoint(rx*Math.cos(angle)*v,rz*Math.sin(angle)*v,lift+.018*(1-v*v));
    },mat,true);
    lampSurface('headlamp-surround',.224,.295,.008,seal);
    lampSurface('headlamp-lens',.204,.270,.015,lens);
    const ring=[];
    for(let i=0;i<48;i++){const a=i*Math.PI*2/48;ring.push(lampPoint(.182*Math.cos(a),.244*Math.sin(a),.027));}
    tube('headlamp-led-signature',ring,.0065,led,root,true);
    for(const x of [-.063,.063])for(const z of [-.094,.094]){
      const projector=new THREE.Group();projector.position.set(...lampPoint(x,z,.036));
      const alongX=new THREE.Vector3(...lampPoint(x+.002,z)).sub(new THREE.Vector3(...lampPoint(x-.002,z)));
      const alongZ=new THREE.Vector3(...lampPoint(x,z+.002)).sub(new THREE.Vector3(...lampPoint(x,z-.002)));
      projector.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),alongZ.cross(alongX).normalize());root.add(projector);
      oval('headlamp-projector',steel,[0,0,0],[.037,.006,.046],projector);
      box('headlamp-led-module',[.039,.008,.024],led,[0,.006,0],[0,0,0],projector);
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
    surface('fender-air-extractor',12,20,(u,v)=>upper(side*(.77+.15*u),1.18+.47*v,.009),carbon,side<0);
    for(let i=0;i<4;i++){
      const z=1.24+i*.10;
      tube('fender-louvre',[upper(side*.78,z,.022),upper(side*.85,z,.025),upper(side*.915,z,.022)],.009,black);
    }
  }
  const roofPoint=(u,v)=>{
    const t=u*2-1,q=v*2-1,w=.66+.065*Math.sin(v*Math.PI)-.015*(1-v);
    return [t*w,1.67-.085*t*t-.072*q*q,-.73+1.05*v+.09*(1-t*t)*q];
  };
  surface('arched-roof',40,40,roofPoint);
  const windscreen=(u,v,rear=false)=>{
    const t=u*2-1,top=roofPoint(u,rear?0:1),z=rear?-1.58:1.01,direction=rear?-1:1;
    const lower=upper(t*.904/section(z)[0],z,.006);
    const a=[top[0]+(lower[0]-top[0])*.26,top[1]-.04,top[2]+direction*.18];
    const b=[lower[0]-(lower[0]-top[0])*.20,lower[1]+.045,lower[2]-direction*.14];
    return top.map((value,k)=>(1-v)**3*value+3*(1-v)**2*v*a[k]+3*(1-v)*v*v*b[k]+v**3*lower[k]);
  };
  surface('front-windscreen',40,32,(u,v)=>windscreen(u,v),glass);
  surface('rear-windscreen',40,32,(u,v)=>windscreen(u,v,true),glass,true);
  for(const rear of [false,true])for(const v of [0,1]){
    const points=[];for(let i=0;i<=24;i++)points.push(windscreen(i/24,v,rear));
    tube('windscreen-seal',points,.013,seal);
  }
  const sideGlass=(side,u,v)=>{
    const zBottom=-1.40+2.34*u,width=.94+.05*(2*u-1)**2+.015*(1-u);
    const top=roofPoint(side>0?1:0,u),lower=upper(side*width/section(zBottom)[0],zBottom,.016);
    return [lower[0]*(1-v)+top[0]*v+side*.045*Math.sin(v*Math.PI),lower[1]*(1-v)+top[1]*v+.012*Math.sin(v*Math.PI),lower[2]*(1-v)+top[2]*v];
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
  for(const points of [[[.10,.96],[.31,.94],[.54,.89]],[[.56,.96],[.73,.94],[.91,.90]]]){
    tube('windscreen-wiper',points.map(([u,v])=>{const p=windscreen(u,v);p[1]+=.008;return p;}),.007,black);
  }
  for(const side of [-1,1]){
    tube('roof-channel',Array.from({length:17},(_,i)=>{const p=roofPoint(side>0?.98:.02,.03+.94*i/16);p[1]+=.002;return p;}),.0035,seal);
  }
  for(let i=-7;i<=7;i++){
    const x=i*.075;
    tube('rear-deck-vent',[-1.98,-1.83,-1.68].map(z=>upper(x/section(z)[0],z,.010)),.010,carbon);
  }
  const tailPoints=[];
  for(let i=0;i<=48;i++){
    const p=cap(false,-.98+1.96*i/48,.91);p[2]-=.012;tailPoints.push(p);
  }
  tube('rear-light-recess',tailPoints,.027,black);
  tube('continuous-rear-led',tailPoints.map(([x,y,z])=>[x,y,z-.018]),.010,tail);
  roundedInset('rear-plate-recess',false,0,.63,.37,.115);
  box('rear-license-panel',[.48,.108,.012],edgePaint,capAt(false,0,.63,.029));
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
