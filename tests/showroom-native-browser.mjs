import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {render3DShowroom} from '../showroom-gt3-native-page.js';

const cwd=process.cwd();
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
  +'<script type="module">'
  +'import * as THREE from "three";'
  +'const render=THREE.WebGLRenderer.prototype.render;'
  +'THREE.WebGLRenderer.prototype.render=function(scene,camera){'
  +'const result=render.call(this,scene,camera);'
  +'if(scene.getObjectByName("EDM28_GT3_Custom"))window.__showroomFrame={scene,camera,renderer:this,THREE};'
  +'return result;};'
  +'await import("/showroom-gt3-native-viewer.js");'
  +'</script>'
  +'</body></html>';
const allowed=new Set([
  '/public-site.css','/showroom-3d-data.js',
  '/showroom-gt3-native-viewer.js','/showroom-gt3-native-model.js',
  '/showroom-gt3-native-body.js','/showroom-gt3-native-wheels.js',
  '/showroom-gt3-native-mechanics.js',
  '/showroom-workshop-hd.js',
  '/node_modules/three/build/three.module.js',
  '/node_modules/three/build/three.core.js',
  '/node_modules/three/examples/jsm/controls/OrbitControls.js'
]);
const server=createServer(async(req,res)=>{
  const path=new URL(req.url||'/', 'http://localhost').pathname;
  if(path==='/'){
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    res.end(html);return;
  }
  if(!allowed.has(path)){res.writeHead(404);res.end('not-found');return;}
  try{
    const content=await readFile(resolve(cwd,'.'+path));
    res.writeHead(200,{'Content-Type':extname(path)==='.css'?'text/css':'text/javascript'});
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
  for(const viewport of [{width:1280,height:860},{width:390,height:844}]){
    const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE_ERROR',e.message);});
    page.on('console',msg=>{if(msg.type()==='error'){errors.push(msg.text());console.error('CONSOLE_ERROR',msg.text().slice(0,800));}});
    page.on('requestfailed',req=>{errors.push('REQUEST_FAILED '+req.url());console.error('REQUEST_FAILED',req.url(),req.failure()?.errorText);});
    page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
    await page.goto('http://127.0.0.1:'+port,{waitUntil:'domcontentloaded',timeout:30000});
    try{await page.waitForSelector('#edm3dShowroom.edm3d-ready',{timeout:18000});}
    catch(error){console.error('READY_TIMEOUT',JSON.stringify({errors,status:await page.locator('#edm3dStatus').textContent().catch(()=>null),visible:await page.locator('#edm3dShowroom').count(),html:(await page.locator('body').innerHTML().catch(()=>''))?.slice(0,750)}));throw error;}
    const canvas=page.locator('#edm3dCanvas canvas');
    assert.equal(await canvas.count(),1);
    const renderFrame=async()=>{
      await canvas.scrollIntoViewIfNeeded();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    };
    await renderFrame();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'showroom overflows the viewport');
    await page.locator('#edm3dShowroom').screenshot({path:resolve(folder,'gt3-'+viewport.width+'-page.png')});
    await renderFrame();
    await canvas.screenshot({path:resolve(folder,'gt3-'+viewport.width+'-full.png')});
    const wheelPoint=await page.evaluate(()=>{
      const {scene,camera,renderer,THREE}=window.__showroomFrame;
      let lock;
      scene.traverse(mesh=>{if(mesh.name==='wheel-center-lock'&&mesh.userData.wheelId==='av-droite')lock=mesh;});
      if(!lock)throw new Error('Front-right wheel center lock is missing');
      const projected=lock.getWorldPosition(new THREE.Vector3()).project(camera);
      const rect=renderer.domElement.getBoundingClientRect();
      return {x:rect.left+(projected.x+1)*rect.width/2,y:rect.top+(1-projected.y)*rect.height/2};
    });
    await page.mouse.click(wheelPoint.x,wheelPoint.y);
    assert.equal(await page.locator('#edm3dWheelChoice').inputValue(),'av-droite','actual canvas click must select its wheel');
    assert.match(await page.locator('#edm3dStepLabel').innerText(),/^0 \/ 5/);
    await page.locator('#edm3dNextStep').click();
    assert.match(await page.locator('#edm3dStepLabel').innerText(),/^1 \/ 5/);
    await renderFrame();
    await canvas.screenshot({path:resolve(folder,'gt3-'+viewport.width+'-wheel-removed.png')});
    for(let i=2;i<=5;i++)await page.locator('#edm3dNextStep').click();
    assert.match(await page.locator('#edm3dStepLabel').innerText(),/^5 \/ 5/);
    await renderFrame();
    await canvas.screenshot({path:resolve(folder,'gt3-'+viewport.width+'-brakes-exploded.png')});
    await page.locator('#edm3dRebuild').click();
    assert.match(await page.locator('#edm3dStepLabel').innerText(),/^0 \/ 5/);
    await page.locator('#edm3dFamilyLiaison').click();
    assert.equal(await page.locator('#edm3dFamilyLiaison').getAttribute('aria-pressed'),'true');
    for(let i=1;i<=5;i++)await page.locator('#edm3dNextStep').click();
    assert.match(await page.locator('#edm3dStepLabel').innerText(),/^5 \/ 5/);
    await renderFrame();
    await canvas.screenshot({path:resolve(folder,'gt3-'+viewport.width+'-suspension-exploded.png')});
    for(const id of ['av-gauche','ar-gauche','ar-droite']){
      await page.locator('#edm3dWheelChoice').selectOption(id);
      assert.match(await page.locator('#edm3dStepLabel').innerText(),/^0 \/ 5/);
      assert.equal(await page.locator('#edm3dFamilyLiaison').isDisabled(),id.startsWith('ar-'));
      assert.equal(await page.locator('#edm3dFamilyFreinage').getAttribute('aria-pressed'),'true');
      await page.locator('#edm3dNextStep').click();
      assert.match(await page.locator('#edm3dStepLabel').innerText(),/^1 \/ 5/);
      await page.locator('#edm3dRebuild').click();
      assert.match(await page.locator('#edm3dStepLabel').innerText(),/^0 \/ 5/);
    }
    await page.locator('[data-part="disques"]').click();
    assert.equal(await page.locator('#edm3dPartTitle').innerText(),'Disques de frein');
    await page.locator('#edm3dReset').click();
    assert.equal(await page.locator('#edm3dWheelChoice').inputValue(),'');
    assert.equal(await page.locator('#edm3dInspection').isHidden(),true);
    await renderFrame();
    const bounds=await canvas.boundingBox();
    const start={x:bounds.x+bounds.width*.18,y:bounds.y+bounds.height*.43};
    await page.mouse.move(start.x,start.y);
    await page.mouse.down();
    await page.mouse.move(start.x+bounds.height/2,start.y,{steps:12});
    await page.mouse.up();
    await renderFrame();
    await canvas.screenshot({path:resolve(folder,'gt3-'+viewport.width+'-rear.png')});
    assert.equal(await page.locator('#edm3dWheelChoice').inputValue(),'','orbit drag must not select a wheel');
    const metrics=await page.evaluate(()=>{
      const {renderer}=window.__showroomFrame;
      return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
    });
    console.log('RENDER_METRICS '+viewport.width+' '+JSON.stringify(metrics));
    assert.deepEqual(errors,[],'Browser runtime errors detected');
    console.log('VIEWPORT_PASS '+viewport.width+'x'+viewport.height+' (canvas selection, all four wheels, brakes, suspension, rebuild, part info, orbit, page layout)');
    await page.close();
  }
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
