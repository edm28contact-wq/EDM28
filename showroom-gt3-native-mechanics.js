export function compactGt3Mechanics(THREE,hd) {
  const geometries=[],removed=new Set(),replacements=[];
  const point=new THREE.Vector3(),normal=new THREE.Vector3();
  const supports=mesh=>{
    if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||mesh.children.length||Array.isArray(mesh.material))return false;
    const geometry=mesh.geometry,attributes=geometry.attributes;
    const p=attributes.position,n=attributes.normal,uv=attributes.uv;
    const count=geometry.index?.count??p?.count??0;
    return p?.itemSize===3&&n?.itemSize===3&&uv?.itemSize===2
      &&n.count===p.count&&uv.count===p.count&&count%3===0
      &&Object.keys(attributes).every(name=>['position','normal','uv'].includes(name))
      &&Object.keys(geometry.morphAttributes).length===0
      &&geometry.drawRange.start===0&&geometry.drawRange.count>=count;
  };
  for(const [name,node] of hd.nodes){
    if(name==='roue')continue;
    const byMaterial=new Map();
    for(const child of node.children){
      if(!supports(child))continue;
      if(child.matrixAutoUpdate)child.updateMatrix();
      if(!child.matrix.elements.every(Number.isFinite)||Math.abs(child.matrix.determinant())<1e-10)continue;
      const key=JSON.stringify([child.userData.partId,child.castShadow,child.receiveShadow,child.visible,child.renderOrder,child.layers.mask]);
      let batches=byMaterial.get(child.material);
      if(!batches){batches=new Map();byMaterial.set(child.material,batches);}
      if(!batches.has(key))batches.set(key,[]);
      batches.get(key).push(child);
    }
    for(const [material,batches] of byMaterial){
      for(const batch of batches.values()){
        if(batch.length<2)continue;
        let vertexCount=0,indexCount=0;
        for(const child of batch){
          vertexCount+=child.geometry.attributes.position.count;
          indexCount+=child.geometry.index?.count??child.geometry.attributes.position.count;
        }
        const positions=new Float32Array(vertexCount*3),normals=new Float32Array(vertexCount*3),uvs=new Float32Array(vertexCount*2);
        const indices=vertexCount>65535?new Uint32Array(indexCount):new Uint16Array(indexCount);
        let vertexOffset=0,indexOffset=0;
        for(const child of batch){
          const geometry=child.geometry,p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
          const normalMatrix=new THREE.Matrix3().getNormalMatrix(child.matrix);
          for(let i=0;i<p.count;i++){
            point.fromBufferAttribute(p,i).applyMatrix4(child.matrix);
            normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
            point.toArray(positions,(vertexOffset+i)*3);
            normal.toArray(normals,(vertexOffset+i)*3);
            uvs[(vertexOffset+i)*2]=uv.getX(i);
            uvs[(vertexOffset+i)*2+1]=uv.getY(i);
          }
          const sourceIndex=geometry.index,count=sourceIndex?.count??p.count;
          const mirrored=child.matrix.determinant()<0;
          for(let i=0;i<count;i+=3){
            const a=sourceIndex?sourceIndex.getX(i):i;
            const b=sourceIndex?sourceIndex.getX(i+1):i+1;
            const c=sourceIndex?sourceIndex.getX(i+2):i+2;
            indices[indexOffset++]=vertexOffset+a;
            indices[indexOffset++]=vertexOffset+(mirrored?c:b);
            indices[indexOffset++]=vertexOffset+(mirrored?b:c);
          }
          vertexOffset+=p.count;
        }
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
        geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
        geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
        geometry.setIndex(new THREE.BufferAttribute(indices,1));
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const first=batch[0],mesh=new THREE.Mesh(geometry,material);
        mesh.name=name+'-'+(first.userData.partId||'detail');
        mesh.userData={...first.userData};
        mesh.castShadow=first.castShadow;
        mesh.receiveShadow=first.receiveShadow;
        mesh.visible=first.visible;
        mesh.renderOrder=first.renderOrder;
        mesh.layers.mask=first.layers.mask;
        batch.forEach(child=>{node.remove(child);removed.add(child);});
        node.add(mesh);
        geometries.push(geometry);
        replacements.push(mesh);
      }
    }
  }
  if(Array.isArray(hd.pickables)){
    const pickables=hd.pickables.filter(mesh=>!removed.has(mesh));
    hd.pickables.splice(0,hd.pickables.length,...pickables,...replacements.filter(mesh=>mesh.userData.partId));
  }
  return {dispose(){geometries.forEach(geometry=>geometry.dispose());}};
}
