import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {render3DShowroom} from '../showroom-gt3-native-page.js';
import data from '../showroom-3d-data.js';

const cwd=process.cwd();
const manifest=JSON.parse(await readFile(resolve(cwd,'assets/models/edm28-gt3-hybrid-v1.json'),'utf8'));
const expectedParts=Object.fromEntries(Object.entries(manifest.wheels).map(([id,wheel])=>[id,wheel.parts]));
const familyOrder=Object.fromEntries(Object.entries(data.disassembly).map(([id,steps])=>[id,steps.map(step=>step.id)]));
const expectedSteps=(id,family)=>{
  const parts=familyOrder[family].filter(part=>expectedParts[id].includes(part));
  return parts.length>1?parts:[];
};
const imports={
  imports:{
    'three':'/node_modules/three/build/three.module.js',
    'three/addons/':'/node_modules/three/examples/jsm/'
  }
};
const html='<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  +'<meta name="viewport" content="width=device-width,initial-scale=1">'
  +'<title>EDM28 GT3 native test</title><link rel="icon" href="data:,">'
  +'<link rel="stylesheet" href="/public-site.css"></head><body>'
  +'<main class="wrap content">'+render3DShowroom()+'</main>'
  +'<script type="importmap">'+JSON.stringify(imports)+'</script>'
  +'<script src="/showroom-3d-data.js"></script>'
  +'<script type="module" src="/showroom-gt3-native-viewer.js"></script>'
  +'</body></html>';
const allowed=new Set([
  '/public-site.css','/showroom-3d-data.js',
  '/showroom-gt3-native-viewer.js','/showroom-gt3-imported-model.js',
  '/assets/models/edm28-gt3-hybrid-v1.glb',
  '/assets/models/edm28-gt3-hybrid-v1.json',
  '/assets/vendor/draco/draco_wasm_wrapper.js',
  '/assets/vendor/draco/draco_decoder.wasm',
  '/node_modules/three/build/three.module.js',
  '/node_modules/three/build/three.core.js',
  '/node_modules/three/examples/jsm/controls/OrbitControls.js',
  '/node_modules/three/examples/jsm/loaders/GLTFLoader.js',
  '/node_modules/three/examples/jsm/loaders/DRACOLoader.js',
  '/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js'
]);
const contentTypes={'.css':'text/css','.js':'text/javascript','.json':'application/json',
  '.glb':'model/gltf-binary','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
  const path=new URL(req.url||'/', 'http://localhost').pathname;
  if(path==='/'){
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    res.end(html);return;
  }
  if(!allowed.has(path)){res.writeHead(404);res.end('not-found');return;}
  try{
    let content=await readFile(resolve(cwd,'.'+path));
    if(path==='/showroom-gt3-native-viewer.js'){
      const marker='scene.add(model.root);';
      const source=content.toString('utf8');
      assert.equal(source.split(marker).length,2,'viewer fixture must instrument exactly one scene attachment');
      content=source.replace(marker,marker+'\nwindow.__showroomFrame={scene,camera,renderer,THREE,model};');
    }
    res.writeHead(200,{'Content-Type':contentTypes[extname(path)],'Content-Length':Buffer.byteLength(content)});
    res.end(content);
  }catch(error){res.writeHead(500);res.end(String(error.message));}
});
const listen=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await listen();
const port=server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:[
    '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
  ]});
  const folder=resolve(cwd,process.env.EDM_SCREENSHOT_DIR||'artifacts/gt3-native');
  await mkdir(folder,{recursive:true});
  for(const viewport of [{width:390,height:844},{width:1280,height:860}]){
    console.log('VIEWPORT_START '+viewport.width+'x'+viewport.height);
    const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce',hasTouch:true});
    const errors=[];
    page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE_ERROR',e.message);});
    page.on('console',msg=>{if(msg.type()==='error'){errors.push(msg.text());console.error('CONSOLE_ERROR',msg.text().slice(0,800));}});
    page.on('requestfailed',req=>{errors.push('REQUEST_FAILED '+req.url());console.error('REQUEST_FAILED',req.url(),req.failure()?.errorText);});
    page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
    await page.goto('http://127.0.0.1:'+port,{waitUntil:'domcontentloaded',timeout:30000});
    try{await page.waitForSelector('#edm3dShowroom.edm3d-ready',{timeout:60000});}
    catch(error){console.error('READY_TIMEOUT',JSON.stringify({errors,status:await page.locator('#edm3dStatus').textContent().catch(()=>null),visible:await page.locator('#edm3dShowroom').count(),html:(await page.locator('body').innerHTML().catch(()=>''))?.slice(0,750)}));throw error;}
    const canvas=page.locator('#edm3dCanvas canvas');
    assert.equal(await canvas.count(),1);
    assert.equal(await page.locator('.edm3d-loading').count(),0,'ready must follow the completed asynchronous import');
    const renderFrame=async()=>{
      await canvas.evaluate(element=>{
        element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
        window.__showroomCaptureSample=null;
      });
      await page.waitForFunction(()=>{
        const {camera,renderer}=window.__showroomFrame;
        const sample=JSON.stringify([scrollX,scrollY,renderer.info.render.frame,...camera.matrixWorld.elements]);
        const stable=sample===window.__showroomCaptureSample;
        window.__showroomCaptureSample=sample;
        return stable;
      },null,{polling:'raf',timeout:30000});
    };
    const capture=async(name,target=canvas)=>{
      console.log('SHOT_BEGIN '+viewport.width+' '+name);
      const bounds=await target.boundingBox();
      assert.ok(bounds&&bounds.width>0&&bounds.height>0,'screenshot target must have visible bounds');
      const state=await page.evaluate(()=>{
        const {renderer,camera}=window.__showroomFrame;
        return {scrollX,scrollY,wheel:document.getElementById('edm3dWheelChoice').value,
          step:document.getElementById('edm3dStepLabel').textContent,
          frame:renderer.info.render.frame,camera:camera.position.toArray(),
          calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
      });
      const fullPage=target!==canvas;
      if(!fullPage)assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width&&bounds.y+bounds.height<=viewport.height,'canvas capture must fit entirely inside the viewport');
      const clip={x:bounds.x+(fullPage?state.scrollX:0),y:bounds.y+(fullPage?state.scrollY:0),width:bounds.width,height:bounds.height};
      console.log('SHOT_STATE '+viewport.width+' '+name+' '+JSON.stringify({...state,fullPage,clip}));
      await page.screenshot({path:resolve(folder,'gt3-'+viewport.width+'-'+name+'.png'),fullPage,clip,timeout:120000});
      console.log('SHOT_PASS '+viewport.width+' '+name);
    };
    await renderFrame();
    const rigReport=await page.evaluate(({expectedParts,familyOrder,wheelAudit})=>{
      const {model,THREE}=window.__showroomFrame;
      const check=(condition,message)=>{if(!condition)throw new Error(message);};
      const same=(actual,expected)=>JSON.stringify(actual)===JSON.stringify(expected);
      check(same([...model.wheels.keys()].sort(),Object.keys(expectedParts).sort()),'Imported wheel inventory differs from the manifest');
      const snapshots=[],partNodes=new Set(),geometries=new Set(),body=[];
      const orders={};
      model.root.updateMatrixWorld(true);
      for(const [id,wheel] of model.wheels){
        check(same([...model.availableParts(id)].sort(),[...expectedParts[id]].sort()),id+' available parts differ from the audited asset');
        check(wheel.side===wheelAudit[id].side&&wheel.front===wheelAudit[id].front,id+' uses the wrong source orientation');
        check(wheel.center.toArray().every(Number.isFinite),id+' has an invalid center');
        const wheelCenter=new THREE.Box3().setFromObject(wheel.nodes.get('roue')).getCenter(new THREE.Vector3());
        check(wheel.center.equals(wheelCenter),id+' center does not match its imported geometry');
        orders[id]={};
        for(const [family,order] of Object.entries(familyOrder)){
          const present=order.filter(part=>expectedParts[id].includes(part));
          orders[id][family]=present.length>1?present:[];
          check(same(model.stepIds(id,family),orders[id][family]),id+'/'+family+' exposes a missing or unordered part');
        }
        for(const [part,node] of wheel.nodes){
          partNodes.add(node);
          snapshots.push({id,part,node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()});
          node.traverse(mesh=>{
            if(!mesh.isMesh)return;
            check(model.pickables.includes(mesh)&&model.raycastTargets.includes(mesh),id+'/'+part+' contains an unselectable mesh');
            const picked=model.toDataPart(mesh);
            check(picked?.wheelId===id&&picked.part===part,id+'/'+part+' maps to the wrong information sheet');
          });
        }
      }
      model.root.traverse(mesh=>{
        if(!mesh.isMesh||mesh.name==='wheel-selection-halo')return;
        geometries.add(mesh.geometry);
        for(let parent=mesh;parent;parent=parent.parent)if(partNodes.has(parent))return;
        body.push({mesh,matrix:mesh.matrixWorld.clone()});
        check(model.raycastTargets.includes(mesh),'Body meshes must occlude wheel picking');
      });
      check(body.length>0,'No fixed body geometry was imported');
      for(const geometry of geometries)for(const name of ['position','normal']){
        const attribute=geometry.getAttribute(name);
        if(!attribute){check(name!=='position','Imported geometry has no positions');continue;}
        const values=attribute.array||attribute.data?.array;
        check(values&&values.every(Number.isFinite),'Imported geometry has non-finite '+name+' values');
      }
      const verifyPose=(id,family,stage)=>{
        const removed=new Set(orders[id]?.[family]?.slice(0,stage)||[]);
        model.root.updateMatrixWorld(true);
        for(const state of snapshots){
          const moved=!state.node.position.equals(state.position);
          check(moved===(state.id===id&&removed.has(state.part)),state.id+'/'+state.part+' has the wrong disassembly position at '+id+'/'+family+'/'+stage);
          check(state.node.quaternion.equals(state.quaternion)&&state.node.scale.equals(state.scale),state.id+'/'+state.part+' lost its original orientation or scale');
        }
        for(const state of body)check(state.mesh.matrixWorld.equals(state.matrix),'Fixed body geometry moved: '+state.mesh.name);
        return true;
      };
      window.__checkShowroomPose=verifyPose;
      let poseCases=0;
      for(const [id,families] of Object.entries(orders))for(const [family,order] of Object.entries(families)){
        for(let stage=0;stage<=order.length;stage++){
          model.setDisassembly(id,family,stage);
          model.animate(1);
          verifyPose(id,family,stage);
          check(model.animate(.15)===false,id+'/'+family+' keeps animating after reaching its target');
          poseCases++;
        }
        model.setDisassembly(id,family,0);
        model.animate(1);
        verifyPose(id,family,0);
      }
      const id=model.wheels.keys().next().value;
      const wheel=model.wheels.get(id).nodes.get('roue');
      const start=wheel.position.clone();
      model.setDisassembly(id,'freinage',1);
      check(model.animate(.15)===true,'A regular-motion disassembly must report a changed frame');
      const intermediate=wheel.position.clone();
      model.animate(1);
      check(intermediate.distanceTo(start)>0&&intermediate.distanceTo(start)<wheel.position.distanceTo(start),'Regular animation must interpolate before reaching the final position');
      model.setDisassembly(null,'freinage',0);
      model.animate(1);
      verifyPose(null,'freinage',0);
      return {wheels:model.wheels.size,parts:snapshots.length,bodyMeshes:body.length,geometries:geometries.size,poseCases};
    },{expectedParts,familyOrder,wheelAudit:manifest.wheels});
    console.log('RIG_PASS '+viewport.width+' '+JSON.stringify(rigReport));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'showroom overflows the viewport');
    await capture('page',page.locator('#edm3dShowroom'));
    await renderFrame();
    await capture('full');
    const findWheelPoint=()=>page.evaluate(()=>{
      const {model,camera,renderer,THREE}=window.__showroomFrame;
      model.root.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const rect=renderer.domElement.getBoundingClientRect();
      const raycaster=new THREE.Raycaster();
      const visible=object=>{
        for(let node=object;node;node=node.parent)if(!node.visible)return false;
        return true;
      };
      const wheels=[...model.wheels.values()].filter(wheel=>wheel.front)
        .sort((a,b)=>camera.position.distanceTo(a.center)-camera.position.distanceTo(b.center));
      for(const wheel of wheels){
        const bounds=new THREE.Box3().setFromObject(wheel.nodes.get('roue'));
        const outerX=wheel.side>0?bounds.max.x:bounds.min.x;
        const samples=[[0,0]];
        for(const radius of [.45,.75])for(let i=0;i<12;i++)samples.push([Math.sin(i*Math.PI/6)*radius,Math.cos(i*Math.PI/6)*radius]);
        for(const [dy,dz] of samples){
          const point=new THREE.Vector3(outerX,wheel.center.y+dy*wheel.radius,wheel.center.z+dz*wheel.radius).project(camera);
          if(Math.abs(point.x)>=1||Math.abs(point.y)>=1||Math.abs(point.z)>=1)continue;
          const x=rect.left+(point.x+1)*rect.width/2,y=rect.top+(1-point.y)*rect.height/2;
          if(document.elementFromPoint(x,y)!==renderer.domElement)continue;
          raycaster.setFromCamera(new THREE.Vector2(point.x,point.y),camera);
          const hit=raycaster.intersectObjects(model.raycastTargets,false).find(hit=>visible(hit.object));
          const picked=hit&&model.toDataPart(hit.object);
          if(picked?.wheelId===wheel.id&&picked.part==='roue')return {id:wheel.id,x,y,mesh:hit.object.name};
        }
      }
      throw new Error('No unobscured front-wheel surface can be clicked in the initial view');
    });
    let wheelPoint=await findWheelPoint();
    console.log('CANVAS_PICK '+viewport.width+' '+JSON.stringify(wheelPoint));
    const unselected=async message=>assert.equal(await page.locator('#edm3dWheelChoice').inputValue(),'',message);
    for(const button of ['right','middle']){
      await page.mouse.click(wheelPoint.x,wheelPoint.y,{button});
      await unselected(button+' mouse button must not select a wheel');
    }
    for(const key of ['Control','Shift','Alt','Meta']){
      await page.keyboard.down(key);
      await page.mouse.click(wheelPoint.x,wheelPoint.y);
      await page.keyboard.up(key);
      await unselected(key+' navigation must not select a wheel');
    }
    await page.mouse.move(wheelPoint.x,wheelPoint.y);
    await page.mouse.down();
    await page.mouse.move(wheelPoint.x+24,wheelPoint.y,{steps:3});
    await page.mouse.move(wheelPoint.x,wheelPoint.y,{steps:3});
    await page.mouse.up();
    await unselected('an orbit gesture returning to its start must not select a wheel');
    assert.equal(await page.locator('#edm3dReset').isEnabled(),true,'manual navigation must enable the home view');
    await page.locator('#edm3dReset').click();
    await renderFrame();
    const homeCamera=await page.evaluate(()=>window.__showroomFrame.camera.position.toArray());
    for(const button of ['edm3dZoomIn','edm3dZoomOut']){
      await page.locator('#'+button).click();
      await renderFrame();
      const changed=await page.evaluate(()=>window.__showroomFrame.camera.position.toArray());
      assert.ok(changed.some((value,index)=>Math.abs(value-homeCamera[index])>.01),'zoom must move the camera');
      await unselected('zoom must leave the complete car selected');
      assert.equal(await page.locator('#edm3dReset').isEnabled(),true,'zoom must enable the home view');
      await page.locator('#edm3dReset').click();
      await renderFrame();
      const restored=await page.evaluate(()=>window.__showroomFrame.camera.position.toArray());
      assert.ok(restored.every((value,index)=>Math.abs(value-homeCamera[index])<1e-6),'home view must restore the camera after zoom');
    }
    wheelPoint=await findWheelPoint();
    const touchSession=await page.context().newCDPSession(page);
    const firstTouch={id:1,x:wheelPoint.x,y:wheelPoint.y};
    const secondTouch={id:2,x:wheelPoint.x+2,y:wheelPoint.y+2};
    await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[firstTouch]});
    await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[firstTouch,secondTouch]});
    await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await unselected('a two-contact gesture must not select a wheel');
    await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[firstTouch]});
    await touchSession.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await unselected('a cancelled touch must not select a wheel');
    await touchSession.detach();
    await page.touchscreen.tap(wheelPoint.x,wheelPoint.y);
    assert.equal(await page.locator('#edm3dWheelChoice').inputValue(),wheelPoint.id,'a valid tap must still work after cancelled gestures');
    await page.locator('#edm3dReset').click();
    await renderFrame();
    wheelPoint=await findWheelPoint();
    console.log('INPUT_PASS '+viewport.width+' (primary tap, secondary buttons, modifiers, return drag, multitouch, cancellation, zoom reset)');
    await page.mouse.click(wheelPoint.x,wheelPoint.y);
    assert.equal(await page.locator('#edm3dWheelChoice').inputValue(),wheelPoint.id,'actual canvas click must select the visible imported wheel');
    const checkStep=async(stage,count)=>{
      assert.match(await page.locator('#edm3dStepLabel').innerText(),new RegExp('^'+stage+' / '+count+' · '));
      assert.equal(await page.locator('#edm3dPrevStep').isDisabled(),stage===0);
      assert.equal(await page.locator('#edm3dNextStep').isDisabled(),stage===count);
      assert.equal(await page.locator('#edm3dRebuild').isDisabled(),stage===0);
    };
    const checkPose=async(id,family,stage)=>{
      await renderFrame();
      await page.evaluate(({id,family,stage})=>window.__checkShowroomPose(id,family,stage),{id,family,stage});
    };
    const wheelIds=[wheelPoint.id,...data.wheels.map(wheel=>wheel.id).filter(id=>id!==wheelPoint.id)];
    for(const id of wheelIds){
      if(id!==wheelPoint.id)await page.locator('#edm3dWheelChoice').selectOption(id);
      assert.equal(await page.locator('#edm3dWheelChoice').inputValue(),id);
      assert.equal(await page.locator('#edm3dFamilyFreinage').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#edm3dFamilyLiaison').isDisabled(),expectedSteps(id,'liaison').length===0);
      for(const family of ['freinage','liaison']){
        const order=expectedSteps(id,family);
        if(!order.length)continue;
        if(family==='liaison')await page.locator('#edm3dFamilyLiaison').click();
        await checkStep(0,order.length);
        await checkPose(id,family,0);
        const lastStage=id===wheelPoint.id?order.length:1;
        for(let stage=1;stage<=lastStage;stage++){
          await page.locator('#edm3dNextStep').click();
          await checkStep(stage,order.length);
          assert.equal(await page.locator('[data-part="'+order[stage-1]+'"]').getAttribute('aria-pressed'),'true');
          if(id===wheelPoint.id&&family==='freinage'&&stage===1){
            await checkPose(id,family,stage);
            await capture('wheel-removed');
          }
        }
        await checkPose(id,family,lastStage);
        if(id===wheelPoint.id)await capture(family==='freinage'?'brakes-exploded':'suspension-exploded');
        await page.locator('#edm3dPrevStep').click();
        await checkStep(lastStage-1,order.length);
        await checkPose(id,family,lastStage-1);
        if(lastStage>1)await page.locator('#edm3dRebuild').click();
        await checkStep(0,order.length);
        await checkPose(id,family,0);
      }
      console.log('WHEEL_UI_PASS '+viewport.width+' '+id+' '+JSON.stringify({freinage:expectedSteps(id,'freinage'),liaison:expectedSteps(id,'liaison')}));
    }
    await page.locator('#edm3dFamilyFreinage').click();
    await page.locator('[data-part="disques"]').click();
    assert.equal(await page.locator('#edm3dPartTitle').innerText(),'Disques de frein');
    await page.locator('[data-part="plaquettes"]').click();
    assert.match(await page.locator('#edm3dPartBody').innerText(),/n’est pas isolé dans le modèle 3D/);
    await checkPose(wheelIds.at(-1),'freinage',0);
    await page.locator('#edm3dReset').click();
    assert.equal(await page.locator('#edm3dWheelChoice').inputValue(),'');
    assert.equal(await page.locator('#edm3dInspection').isHidden(),true);
    await checkPose(null,'freinage',0);
    const bounds=await canvas.boundingBox();
    const start={x:bounds.x+bounds.width*.18,y:bounds.y+bounds.height*.43};
    await page.mouse.move(start.x,start.y);
    await page.mouse.down();
    await page.mouse.move(start.x+bounds.height/2,start.y,{steps:4});
    await page.mouse.up();
    await renderFrame();
    await capture('rear');
    if(viewport.width===1280){
      const rotation=await page.evaluate(()=>{
        const {camera,THREE}=window.__showroomFrame;
        const direction=camera.getWorldDirection(new THREE.Vector3());
        const difference=Math.PI/2-Math.atan2(-direction.x,-direction.z);
        return Math.atan2(Math.sin(difference),Math.cos(difference));
      });
      const profileBounds=await canvas.boundingBox();
      const profileStart={x:profileBounds.x+profileBounds.width/2,y:profileBounds.y+profileBounds.height*.43};
      await page.mouse.move(profileStart.x,profileStart.y);
      await page.mouse.down();
      await page.mouse.move(profileStart.x-rotation*profileBounds.height/(Math.PI*2),profileStart.y,{steps:4});
      await page.mouse.up();
      await renderFrame();
      await capture('profile');
    }
    assert.equal(await page.locator('#edm3dWheelChoice').inputValue(),'','orbit drag must not select a wheel');
    const metrics=await page.evaluate(()=>{
      const {renderer}=window.__showroomFrame;
      return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
    });
    console.log('RENDER_METRICS '+viewport.width+' '+JSON.stringify(metrics));
    if(viewport.width===1280){
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForSelector('#edm3dShowroom.edm3d-ready',{timeout:60000});
      await renderFrame();
      const home=await page.evaluate(()=>window.__showroomFrame.camera.position.toArray());
      await page.locator('#edm3dRotate').click();
      assert.equal(await page.locator('#edm3dRotate').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#edm3dReset').isEnabled(),true,'automatic rotation must enable the home view');
      await page.waitForFunction(home=>window.__showroomFrame.camera.position.toArray().some((value,index)=>Math.abs(value-home[index])>.05),home,{timeout:30000});
      await page.locator('#edm3dReset').click();
      assert.equal(await page.locator('#edm3dRotate').getAttribute('aria-pressed'),'false','home view must stop automatic rotation');
      await renderFrame();
      const reset=await page.evaluate(()=>window.__showroomFrame.camera.position.toArray());
      assert.ok(reset.every((value,index)=>Math.abs(value-home[index])<1e-6),'animated home view must return precisely to the initial camera');
      console.log('ROTATION_RESET_PASS (normal motion, automatic orbit, home view, stable rendering)');
    }
    assert.deepEqual(errors,[],'Browser runtime errors detected');
    console.log('VIEWPORT_PASS '+viewport.width+'x'+viewport.height+' (canvas selection, all four wheels, brakes, suspension, rebuild, part info, orbit, page layout)');
    await page.close();
  }
  const unavailable=await browser.newPage({viewport:{width:1280,height:860}});
  const assetRequests=[];
  unavailable.on('request',request=>{if(request.url().includes('/assets/models/'))assetRequests.push(request.url());});
  await unavailable.addInitScript(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      return ['webgl','webgl2','experimental-webgl'].includes(type)?null:getContext.call(this,type,...args);
    };
  });
  await unavailable.goto('http://127.0.0.1:'+port,{waitUntil:'domcontentloaded'});
  await unavailable.waitForSelector('#edm3dShowroom.edm3d-unavailable');
  assert.equal(await unavailable.locator('#edm3dFallback').isVisible(),true);
  assert.equal(await unavailable.locator('#edm3dShowroom button:enabled,#edm3dShowroom select:enabled').count(),0,'unavailable WebGL must not leave inactive controls enabled');
  const failureStatus=await unavailable.locator('#edm3dStatus').innerText();
  assert.match(failureStatus,/La 3D est indisponible dans ce navigateur/);
  assert.doesNotMatch(failureStatus,/error is not a function|TypeError|WebGLRenderer/);
  assert.equal(await unavailable.locator('#edm3dFallback a[href="/demande"]').isVisible(),true);
  assert.deepEqual(assetRequests,[],'unavailable WebGL must not download the model');
  await unavailable.screenshot({path:resolve(folder,'gt3-webgl-unavailable.png'),fullPage:true});
  console.log('WEBGL_FALLBACK_PASS (clear message, disabled controls, service links, no model download)');
  await unavailable.close();
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
