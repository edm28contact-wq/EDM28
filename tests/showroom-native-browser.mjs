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
  +'<title>EDM28 GT3 native test</title><style>body{background:#dce1e5;margin:12px;font-family:Arial,sans-serif}</style>'
  +'<link rel="stylesheet" href="/public-site.css"></head><body>'
  +render3DShowroom()
  +'<script type="importmap">'+JSON.stringify(imports)+'</script>'
  +'<script src="/showroom-3d-data.js"></script>'
  +'<script type="module" src="/showroom-gt3-native-viewer.js"></script>'
  +'</body></html>';
const allowed=new Set([
  '/public-site.css','/showroom-3d-data.js',
  '/showroom-gt3-native-viewer.js','/showroom-gt3-native-model.js',
  '/showroom-workshop-hd.js',
  '/node_modules/three/build/three.module.js',
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
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
  ]});
  const folder=resolve(cwd,'artifacts/gt3-native');
  await mkdir(folder,{recursive:true});
  for(const viewport of [{width:1280,height:860},{width:390,height:844}]){
    const page=await browser.newPage({viewport,deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
    await page.goto('http://127.0.0.1:'+port,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('#edm3dShowroom.edm3d-ready',{timeout:45000});
    const canvas=page.locator('#edm3dCanvas canvas');
    assert.equal(await canvas.count(),1);
    await page.waitForTimeout(1100);
    await canvas.screenshot({path:resolve(folder,'gt3-'+viewport.width+'-full.png')});
    await page.locator('#edm3dWheelChoice').selectOption('av-gauche');
    assert.match(await page.locator('#edm3dStepLabel').innerText(),/^0 \/ 5/);
    await page.locator('#edm3dNextStep').click();
    assert.match(await page.locator('#edm3dStepLabel').innerText(),/^1 \/ 5/);
    await page.waitForTimeout(750);
    await canvas.screenshot({path:resolve(folder,'gt3-'+viewport.width+'-wheel-removed.png')});
    for(let i=2;i<=5;i++)await page.locator('#edm3dNextStep').click();
    assert.match(await page.locator('#edm3dStepLabel').innerText(),/^5 \/ 5/);
    await page.locator('#edm3dRebuild').click();
    assert.match(await page.locator('#edm3dStepLabel').innerText(),/^0 \/ 5/);
    await page.locator('#edm3dFamilyLiaison').click();
    assert.equal(await page.locator('#edm3dFamilyLiaison').getAttribute('aria-pressed'),'true');
    await page.locator('#edm3dNextStep').click();
    assert.match(await page.locator('#edm3dStepLabel').innerText(),/^1 \/ 5/);
    await page.locator('#edm3dWheelChoice').selectOption('ar-droite');
    assert.equal(await page.locator('#edm3dFamilyLiaison').isDisabled(),true);
    assert.equal(await page.locator('#edm3dFamilyFreinage').getAttribute('aria-pressed'),'true');
    await page.locator('[data-part="disques"]').click();
    assert.equal(await page.locator('#edm3dPartTitle').innerText(),'Disques de frein');
    await page.locator('#edm3dReset').click();
    assert.equal(await page.locator('#edm3dWheelChoice').inputValue(),'');
    assert.equal(await page.locator('#edm3dInspection').isHidden(),true);
    assert.deepEqual(errors,[],'Browser runtime errors detected');
    console.log('VIEWPORT_PASS '+viewport.width+'x'+viewport.height+' (wheel removal, brakes, suspension, rebuild, part info)');
    await page.close();
  }
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
